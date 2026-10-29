/**
 * Shared scoring helpers for Feedback documents.
 *
 * Current form structure (Course Feedback):
 *   - Course Content & Organisation : courseContentOrg.q1_upToDate
 *   - Per-CO (CO1, CO2, ...)        : coFeedback[].q1_contentAligned,
 *                                     coFeedback[].q2_methodsEffective,
 *                                     coFeedback[].q3_assessmentAppropriate
 *   - Academic & Lab Facilities     : academicFacilities.q1_infrastructure
 *   - Course Teacher (1-5)          : courseTeacherEval.rating
 *
 * Older submissions used different questions; each helper falls back to the
 * legacy fields so previously stored feedback keeps contributing to reports.
 */

function safeNum(val) {
  const n = Number(val);
  return (!isNaN(n) && isFinite(n) && n > 0) ? n : null;
}

function mean(values) {
  const valid = values.filter(v => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Course Content & Organisation
function contentScore(f) {
  const c = f.courseContentOrg || f.courseContent;
  if (!c) return null;
  const current = safeNum(c.q1_upToDate);
  if (current !== null) return current;
  return mean([
    safeNum(c.q1_objectives || c.q1),
    safeNum(c.q2_workload || c.q2),
    safeNum(c.q3_organized || c.q3),
  ]);
}

// Score for a single CO entry
function coEntryScore(co) {
  if (!co) return null;
  const current = mean([
    safeNum(co.q1_contentAligned),
    safeNum(co.q2_methodsEffective),
    safeNum(co.q3_assessmentAppropriate),
  ]);
  if (current !== null) return current;
  return safeNum(co.q1_achievement);
}

// Average across all COs in a feedback
function coScore(f) {
  if (!Array.isArray(f.coFeedback) || f.coFeedback.length === 0) return null;
  return mean(f.coFeedback.map(coEntryScore));
}

// Academic & Laboratory Facilities
function facilitiesScore(f) {
  const af = f.academicFacilities || f.learningResources;
  if (!af) return null;
  const current = safeNum(af.q1_infrastructure);
  if (current !== null) return current;
  return mean([
    safeNum(af.q1_environment || f.learningEnvironment?.q10),
    safeNum(af.q2_classrooms || f.learningEnvironment?.q11),
    safeNum(af.q3_laboratory || af.q15),
  ]);
}

// Course Teacher (1-5 numeric rating)
function teacherScore(f) {
  return safeNum(f.courseTeacherEval?.rating);
}

// Legacy Teaching-Learning & Assessment section (removed from the form; old data only)
function legacyTeachingLearningScore(f) {
  const tl = f.teachingLearning || f.learningEnvironment;
  if (!tl) return null;
  return mean([
    safeNum(tl.q1_structured || tl.q8),
    safeNum(tl.q2_participation || tl.q9),
    safeNum(tl.q3_materials || f.learningResources?.q13),
    safeNum(tl.q4_assessment),
  ]);
}

// All section scores for one feedback
function sectionScores(f) {
  return {
    content: contentScore(f),
    co: coScore(f),
    facilities: facilitiesScore(f),
    teacher: teacherScore(f),
  };
}

// Overall average of the available sections for one feedback (null if none)
function feedbackAverage(f) {
  const s = sectionScores(f);
  return mean([s.content, s.co, s.facilities, s.teacher]);
}

const round2 = (v) => (v !== null && !isNaN(v) && isFinite(v)) ? Math.round(v * 100) / 100 : 0;

/**
 * Aggregate section averages across a list of feedbacks.
 * Returns { avgCourseContent, avgCOAttainment, avgFacilities, avgCourseTeacher, avgRating }
 */
function aggregateScores(feedbacks) {
  const buckets = { content: [], co: [], facilities: [], teacher: [] };
  (feedbacks || []).forEach(f => {
    const s = sectionScores(f);
    Object.keys(buckets).forEach(k => { if (s[k] !== null) buckets[k].push(s[k]); });
  });

  const avgCourseContent = round2(mean(buckets.content));
  const avgCOAttainment = round2(mean(buckets.co));
  const avgFacilities = round2(mean(buckets.facilities));
  const avgCourseTeacher = round2(mean(buckets.teacher));
  const sections = [avgCourseContent, avgCOAttainment, avgFacilities, avgCourseTeacher].filter(v => v > 0);
  const avgRating = sections.length > 0 ? round2(mean(sections)) : 0;

  return { avgCourseContent, avgCOAttainment, avgFacilities, avgCourseTeacher, avgRating };
}

/**
 * Collect non-empty comment strings across current and legacy feedback sections.
 */
function extractFeedbackComments(f) {
  if (!f) return [];
  const raw = [
    f.courseContentOrg?.comment,
    ...(Array.isArray(f.coFeedback) ? f.coFeedback.map(c => c?.comment) : []),
    f.academicFacilities?.comment,
    f.courseTeacherEval?.comment,
    f.teachingLearning?.comment,
    f.overallComment,
    f.commentsAndSuggestions,
    f.generalComment,
  ];
  const seen = new Set();
  const out = [];
  raw.forEach(item => {
    const trimmed = typeof item === 'string' ? item.trim() : '';
    if (trimmed && trimmed.toLowerCase() !== 'no comments' && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  });
  return out;
}

/**
 * Attach computed `rating` and `comment` summary to a feedback object for UI views.
 */
function enrichFeedbackForDisplay(f) {
  const obj = f && typeof f.toObject === 'function' ? f.toObject() : { ...f };
  const avg = feedbackAverage(obj);
  if (obj.rating === undefined || obj.rating === null) {
    obj.rating = avg !== null ? Math.round(avg * 10) / 10 : 0;
  }
  if (!obj.comment) {
    const comments = extractFeedbackComments(obj);
    obj.comment = comments.join(' | ');
  }
  return obj;
}

module.exports = {
  safeNum,
  mean,
  contentScore,
  coEntryScore,
  coScore,
  facilitiesScore,
  teacherScore,
  legacyTeachingLearningScore,
  sectionScores,
  feedbackAverage,
  aggregateScores,
  extractFeedbackComments,
  enrichFeedbackForDisplay,
};

