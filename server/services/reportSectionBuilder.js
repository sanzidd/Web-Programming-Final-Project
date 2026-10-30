const mongoose = require('mongoose');
const FeedbackConfig = require('../models/FeedbackConfig');
const { safeNum, mean } = require('../utils/feedbackScores');

const LIKERT_LABELS = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];
const TEACHER_RATING_LABELS = ['5 - Excellent', '4 - Very Good', '3 - Good', '2 - Fair', '1 - Poor'];

function ratingToText(val) {
  const map = { 5: 'Strongly Agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly Disagree' };
  return map[Number(val)] || '';
}

function teacherRatingToText(val) {
  const map = { 5: '5 - Excellent', 4: '4 - Very Good', 3: '3 - Good', 2: '2 - Fair', 1: '1 - Poor' };
  return map[Number(val)] || '';
}

function scoreToScaleText(val, scaleType) {
  return scaleType === 'rating' ? teacherRatingToText(val) : ratingToText(val);
}

function formatCOTitle(co, coNum) {
  const rawTitle = (co?.title || '').trim();
  const rawDesc = (co?.description || '').trim();
  const isGeneric = !rawTitle || rawTitle.toUpperCase() === `CO${coNum}`;
  if (isGeneric) {
    return rawDesc ? `CO${coNum}: ${rawDesc}` : `CO${coNum}`;
  }
  if (rawDesc && rawDesc !== rawTitle && !rawTitle.includes(rawDesc)) {
    return `CO${coNum}: ${rawTitle} (${rawDesc})`;
  }
  return `CO${coNum}: ${rawTitle}`;
}

function resolveCOQuestionText(templateText, coNum) {
  const raw = String(templateText || '').trim();
  if (!raw) return `Evaluation of CO${coNum}`;
  if (/\{co\}/i.test(raw)) {
    return raw.replace(/\{co\}/gi, `CO${coNum}`);
  }
  if (/\bthis\s+CO\b/i.test(raw)) {
    return raw.replace(/\bthis\s+CO\b/gi, `CO${coNum}`);
  }
  return `${raw} (CO${coNum})`;
}

async function resolveFeedbackConfig(passedConfig) {
  if (passedConfig && passedConfig.courseContent) return passedConfig;
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const doc = await FeedbackConfig.getConfig();
      return doc.toObject ? doc.toObject() : doc;
    } catch {
      return FeedbackConfig.getDefaultPayload();
    }
  }
  return FeedbackConfig.getDefaultPayload();
}

function isRealComment(c) {
  return Boolean(c && typeof c === 'string' && c.trim() && c.trim().toLowerCase() !== 'no comments');
}

function lookupResponseScore(responses, qId, fallbackVal) {
  if (Array.isArray(responses) && responses.length > 0) {
    const exact = responses.find(r => r && r.questionId === qId);
    if (exact && safeNum(exact.score) !== null) return safeNum(exact.score);
  }
  return safeNum(fallbackVal);
}

async function buildReportData({ assignment = {}, feedbacks = [], feedbackConfig = null }) {
  const cfg = await resolveFeedbackConfig(feedbackConfig);

  const courseName = assignment.courseName || 'Course';
  const courseCode = assignment.courseCode || '';
  const semester = assignment.semester || '';
  const series = assignment.series || '';
  const teacherName = assignment.teacher?.name || 'Unknown';
  const teacherDesignation = assignment.teacher?.designation || '';
  const deptName = assignment.department?.name || 'Electronics and Telecommunication Engineering';
  const deptCode = assignment.department?.code || 'ETE';

  let cos = Array.isArray(assignment.courseOutcomes) && assignment.courseOutcomes.length > 0
    ? assignment.courseOutcomes
    : [];

  if (cos.length === 0 && feedbacks.length > 0) {
    const coMap = new Map();
    feedbacks.forEach(f => {
      (f.coFeedback || []).forEach(c => {
        if (c.coNumber && !coMap.has(c.coNumber)) {
          coMap.set(c.coNumber, {
            coNumber: c.coNumber,
            title: c.coTitle || `CO${c.coNumber}`,
            description: c.coDescription || ''
          });
        }
      });
    });
    cos = Array.from(coMap.values()).sort((a, b) => a.coNumber - b.coNumber);
  }

  if (cos.length === 0) {
    cos = [
      { coNumber: 1, title: 'CO1', description: 'Course Outcome 1' },
      { coNumber: 2, title: 'CO2', description: 'Course Outcome 2' }
    ];
  }

  let nextQNum = 1;
  const sections = [];

  // 1. Course Content Section
  const ccQuestions = (cfg.courseContent?.questions || []).filter(q => q && q.text?.trim());
  if (ccQuestions.length > 0) {
    const scaleType = cfg.courseContent?.scaleType === 'rating' ? 'rating' : 'likert';
    const title = (cfg.courseContent?.title || 'Course Content and Organization').trim();
    const mappedQs = ccQuestions.map((q, idx) => ({
      id: q.id || `cc_q${idx + 1}`,
      text: q.text.trim(),
      qNum: nextQNum++,
      idx
    }));
    sections.push({
      key: 'courseContent',
      inputHeaderTitle: title,
      ffTitle: title,
      metricTitle: title,
      commentHeaderTitle: `Comments on ${title} (if any)`,
      scaleType,
      scaleLabels: scaleType === 'rating' ? TEACHER_RATING_LABELS : LIKERT_LABELS,
      questions: mappedQs,
      extract(fb) {
        const c = fb?.courseContentOrg || {};
        const legacyByIdx = [
          c.q1_upToDate || c.q3_organized,
          c.q2_workload,
          c.q1_objectives
        ];
        const scores = mappedQs.map((q, idx) => {
          const byId = lookupResponseScore(c.responses, q.id, undefined);
          if (byId !== null) return byId;
          if (Array.isArray(c.responses) && c.responses[idx] && safeNum(c.responses[idx].score) !== null) {
            return safeNum(c.responses[idx].score);
          }
          return safeNum(legacyByIdx[idx]);
        });
        return {
          scores,
          texts: scores.map(s => scoreToScaleText(s, scaleType)),
          comment: (c.comment || '').trim()
        };
      }
    });
  }

  // 2. Dynamic CO Sections
  const coQuestions = (cfg.coSection?.questions || []).filter(q => q && q.text?.trim());
  if (coQuestions.length > 0) {
    const scaleType = cfg.coSection?.scaleType === 'rating' ? 'rating' : 'likert';
    cos.forEach((co, cIdx) => {
      const coNum = co.coNumber || (cIdx + 1);
      const coLabel = formatCOTitle(co, coNum);
      const mappedQs = coQuestions.map((q, idx) => ({
        id: q.id || `co_q${idx + 1}`,
        text: resolveCOQuestionText(q.text, coNum),
        qNum: nextQNum++,
        idx
      }));
      sections.push({
        key: `co_${coNum}`,
        isCO: true,
        coNum,
        inputHeaderTitle: `Questions Related to ${coLabel}`,
        ffTitle: coLabel,
        metricTitle: coLabel,
        commentHeaderTitle: `Comments on CO${coNum} (if any)`,
        scaleType,
        scaleLabels: scaleType === 'rating' ? TEACHER_RATING_LABELS : LIKERT_LABELS,
        questions: mappedQs,
        extract(fb) {
          const cd = (fb?.coFeedback || []).find(c => Number(c.coNumber) === Number(coNum)) || {};
          const legacyByIdx = [
            cd.q1_contentAligned || cd.q1_achievement,
            cd.q2_methodsEffective || cd.q2_alignment,
            cd.q3_assessmentAppropriate || cd.q3_assessment
          ];
          const scores = mappedQs.map((q, idx) => {
            const byId = lookupResponseScore(cd.responses, q.id, undefined);
            if (byId !== null) return byId;
            if (Array.isArray(cd.responses) && cd.responses[idx] && safeNum(cd.responses[idx].score) !== null) {
              return safeNum(cd.responses[idx].score);
            }
            return safeNum(legacyByIdx[idx]);
          });
          return {
            scores,
            texts: scores.map(s => scoreToScaleText(s, scaleType)),
            comment: (cd.comment || '').trim()
          };
        }
      });
    });
  }

  // 3. Academic & Laboratory Facilities Section
  const facQuestions = (cfg.facilities?.questions || []).filter(q => q && q.text?.trim());
  if (facQuestions.length > 0) {
    const scaleType = cfg.facilities?.scaleType === 'rating' ? 'rating' : 'likert';
    const title = (cfg.facilities?.title || 'Academic and Laboratory Facilities').trim();
    const mappedQs = facQuestions.map((q, idx) => ({
      id: q.id || `fac_q${idx + 1}`,
      text: q.text.trim(),
      qNum: nextQNum++,
      idx
    }));
    sections.push({
      key: 'facilities',
      inputHeaderTitle: title,
      ffTitle: title,
      metricTitle: title,
      commentHeaderTitle: 'Comments on Facilities (if any)',
      scaleType,
      scaleLabels: scaleType === 'rating' ? TEACHER_RATING_LABELS : LIKERT_LABELS,
      questions: mappedQs,
      extract(fb) {
        const af = fb?.academicFacilities || {};
        const legacyByIdx = [
          af.q1_infrastructure || af.q3_laboratory,
          af.q2_classrooms,
          af.q1_environment
        ];
        const scores = mappedQs.map((q, idx) => {
          const byId = lookupResponseScore(af.responses, q.id, undefined);
          if (byId !== null) return byId;
          if (Array.isArray(af.responses) && af.responses[idx] && safeNum(af.responses[idx].score) !== null) {
            return safeNum(af.responses[idx].score);
          }
          return safeNum(legacyByIdx[idx]);
        });
        return {
          scores,
          texts: scores.map(s => scoreToScaleText(s, scaleType)),
          comment: (af.comment || '').trim()
        };
      }
    });
  }

  // 4. Course Teacher Section
  const ctQuestions = (cfg.courseTeacher?.questions || []).filter(q => q && q.text?.trim());
  if (ctQuestions.length > 0) {
    const scaleType = cfg.courseTeacher?.scaleType === 'likert' ? 'likert' : 'rating';
    const title = (cfg.courseTeacher?.title || 'Course Teacher').trim();
    const mappedQs = ctQuestions.map((q, idx) => ({
      id: q.id || `ct_q${idx + 1}`,
      text: q.text.trim(),
      qNum: nextQNum++,
      idx
    }));
    sections.push({
      key: 'courseTeacher',
      inputHeaderTitle: title,
      ffTitle: title,
      metricTitle: title,
      commentHeaderTitle: `Comments on ${title} (if any)`,
      scaleType,
      scaleLabels: scaleType === 'rating' ? TEACHER_RATING_LABELS : LIKERT_LABELS,
      questions: mappedQs,
      extract(fb) {
        const ct = fb?.courseTeacherEval || {};
        const legacyByIdx = [ct.rating];
        const scores = mappedQs.map((q, idx) => {
          const byId = lookupResponseScore(ct.responses, q.id, undefined);
          if (byId !== null) return byId;
          if (Array.isArray(ct.responses) && ct.responses[idx] && safeNum(ct.responses[idx].score) !== null) {
            return safeNum(ct.responses[idx].score);
          }
          return safeNum(legacyByIdx[idx]);
        });
        return {
          scores,
          texts: scores.map(s => scoreToScaleText(s, scaleType)),
          comment: (ct.comment || '').trim()
        };
      }
    });
  }

  // 5. Optional Custom Sections
  (cfg.customSections || []).forEach((sec, sIdx) => {
    const qs = (sec?.questions || []).filter(q => q && q.text?.trim());
    if (qs.length === 0) return;
    const scaleType = sec.scaleType === 'rating' ? 'rating' : 'likert';
    const title = (sec.title || `Section ${sIdx + 1}`).trim();
    const secId = sec.id || `custom_${sIdx + 1}`;
    const mappedQs = qs.map((q, idx) => ({
      id: q.id || `${secId}_q${idx + 1}`,
      text: q.text.trim(),
      qNum: nextQNum++,
      idx
    }));
    sections.push({
      key: secId,
      inputHeaderTitle: title,
      ffTitle: title,
      metricTitle: title,
      commentHeaderTitle: `Comments on ${title} (if any)`,
      scaleType,
      scaleLabels: scaleType === 'rating' ? TEACHER_RATING_LABELS : LIKERT_LABELS,
      questions: mappedQs,
      extract(fb) {
        const cs = (fb?.customSections || []).find(s => s.sectionId === secId) || {};
        const scores = mappedQs.map((q, idx) => {
          const byId = lookupResponseScore(cs.responses, q.id, undefined);
          if (byId !== null) return byId;
          if (Array.isArray(cs.responses) && cs.responses[idx] && safeNum(cs.responses[idx].score) !== null) {
            return safeNum(cs.responses[idx].score);
          }
          return null;
        });
        return {
          scores,
          texts: scores.map(s => scoreToScaleText(s, scaleType)),
          comment: (cs.comment || '').trim()
        };
      }
    });
  });

  // Compute per-section statistics across all feedbacks
  const totalStudents = feedbacks.length;
  const allSectionStudentMeans = [];

  sections.forEach(sec => {
    const extractedRows = feedbacks.map(fb => sec.extract(fb));
    sec.extractedRows = extractedRows;
    sec.comments = extractedRows.map(r => r.comment).filter(isRealComment);

    // Percentage distribution per scaleLabel across each question
    sec.distributions = sec.scaleLabels.map(label => {
      const values = sec.questions.map((_, qIdx) => {
        if (totalStudents === 0) return 0;
        let matches = 0;
        extractedRows.forEach(r => {
          if (r.texts[qIdx] === label) matches++;
        });
        return +((matches / totalStudents) * 100).toFixed(1);
      });
      return { label, values };
    });

    // Per-student mean score for this section (for Section B Summary)
    const studentMeans = extractedRows
      .map(r => mean(r.scores.filter(v => v !== null)))
      .filter(v => v !== null);

    sec.studentMeans = studentMeans;
    sec.avgScore = studentMeans.length > 0
      ? +(studentMeans.reduce((a, b) => a + b, 0) / studentMeans.length).toFixed(2)
      : 0;
    sec.attainmentPct = studentMeans.length > 0
      ? `${Math.round((studentMeans.filter(v => v >= 3).length / studentMeans.length) * 100)}%`
      : '0%';

    allSectionStudentMeans.push(...studentMeans);
  });

  const overallAvg = allSectionStudentMeans.length > 0
    ? +(allSectionStudentMeans.reduce((a, b) => a + b, 0) / allSectionStudentMeans.length).toFixed(2)
    : 0;
  const overallAttainmentPct = allSectionStudentMeans.length > 0
    ? `${Math.round((allSectionStudentMeans.filter(v => v >= 3).length / allSectionStudentMeans.length) * 100)}%`
    : '0%';

  return {
    meta: {
      courseName,
      courseCode,
      semester,
      series,
      teacherName,
      teacherDesignation,
      deptName,
      deptCode,
      totalStudents
    },
    cos,
    sections,
    overallAvg,
    overallAttainmentPct
  };
}

module.exports = {
  LIKERT_LABELS,
  TEACHER_RATING_LABELS,
  ratingToText,
  teacherRatingToText,
  scoreToScaleText,
  formatCOTitle,
  resolveCOQuestionText,
  buildReportData
};

