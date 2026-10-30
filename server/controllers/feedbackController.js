const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const FeedbackLog = require('../models/FeedbackLog');
const CourseAssignment = require('../models/CourseAssignment');
const FeedbackConfig = require('../models/FeedbackConfig');
const Student = require('../models/Student');
const Department = require('../models/Department');
const ReviewSession = require('../models/ReviewSession');
const { aggregateScores } = require('../utils/feedbackScores');
const { resolveCOQuestionText } = require('../services/reportSectionBuilder');

/**
 * Helper to generate all common variants of a series string
 */
function getSeriesMatchVariants(inputSeries) {
  if (!inputSeries) return ['all', 'All', '*', ''];
  const raw = String(inputSeries).trim();
  const digits = raw.replace(/\D/g, '');
  const variants = new Set(['all', 'All', '*', '', raw, raw.toLowerCase()]);

  if (digits.length >= 2) {
    const s2 = digits.slice(-2);
    const s4 = `20${s2}`;
    variants.add(s2);
    variants.add(s4);
    variants.add(`Series ${s2}`);
    variants.add(`series ${s2}`);
    variants.add(`Series ${s4}`);
    variants.add(`series ${s4}`);
    variants.add(`'${s2}`);
    variants.add(`Batch ${s2}`);
    variants.add(`Batch ${s4}`);
  }
  return Array.from(variants);
}

// Get current review session status (public/student accessible)
exports.getSessionStatus = async (req, res) => {
  try {
    const session = await ReviewSession.getCurrentSession();
    res.json({
      isOpen: session.isOpen,
      sessionName: session.sessionName,
      startDate: session.startDate,
      endDate: session.endDate,
      message: session.message,
      closedMessage: session.closedMessage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Public / Student endpoint to fetch active Admin-configured feedback questions
exports.getFeedbackQuestions = async (req, res) => {
  try {
    const config = await FeedbackConfig.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get assignments eligible for current student
exports.getMyAssignments = async (req, res) => {
  try {
    if (!req.studentId) {
      return res.status(401).json({ message: 'Student authentication required' });
    }
    const student = await Student.findById(req.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const rawSeries = String(student.series || (student.roll && student.roll.length >= 2 ? student.roll.substring(0, 2) : '')).trim();
    const digits = rawSeries.replace(/\D/g, '');
    const s2 = digits.length >= 2 ? digits.slice(-2) : rawSeries;
    const seriesVariants = getSeriesMatchVariants(s2 || rawSeries);

    const seriesQuery = {
      $or: [
        { series: { $in: seriesVariants } },
        ...(s2 ? [{ series: new RegExp(`(^|\\b|20)?${s2}(\\b|$)`, 'i') }] : [])
      ]
    };

    let studentDeptId = student.department;
    if (studentDeptId) {
      const deptExists = await Department.findById(studentDeptId);
      if (!deptExists) studentDeptId = null;
    }

    if (!studentDeptId && student.roll && student.roll.length >= 4) {
      const deptDigits = student.roll.substring(2, 4);
      const deptCodeMap = {
        '01': 'CE',
        '02': 'EEE',
        '03': 'ME',
        '04': 'ETE',
        '05': 'CSE',
        '06': 'IPE',
        '07': 'MTE',
        '08': 'MSE',
        '09': 'CHE',
        '10': 'CME',
        '11': 'URP',
        '12': 'BECM',
        '13': 'ARCH'
      };
      const code = deptCodeMap[deptDigits];
      if (code) {
        const foundDept = await Department.findOne({ code });
        if (foundDept) {
          studentDeptId = foundDept._id;
          student.department = foundDept._id;
          if (!student.series && s2) student.series = s2;
          await student.save();
        }
      }
    }

    let assignments = [];
    if (studentDeptId) {
      assignments = await CourseAssignment.find({
        isActive: true,
        department: studentDeptId,
        ...seriesQuery
      })
        .populate('department', 'name code')
        .populate('teacherDepartment', 'name code')
        .populate({
          path: 'teacher',
          select: 'name designation email courses department',
          populate: { path: 'department', select: 'name code' }
        })
        .sort({ courseCode: 1, courseName: 1 });
    }

    if (!studentDeptId && s2) {
      assignments = await CourseAssignment.find({
        isActive: true,
        ...seriesQuery
      })
        .populate('department', 'name code')
        .populate('teacherDepartment', 'name code')
        .populate({
          path: 'teacher',
          select: 'name designation email courses department',
          populate: { path: 'department', select: 'name code' }
        })
        .sort({ courseCode: 1, courseName: 1 });
    }

    const feedbackLogs = await FeedbackLog.find({ student: req.studentId }).select('assignment');
    const reviewedAssignmentIds = new Set(
      feedbackLogs
        .filter(log => log && log.assignment)
        .map(log => log.assignment.toString())
    );

    const assignmentsWithStatus = assignments.map(a => {
      const obj = a.toObject();
      const isDeadlinePassed = CourseAssignment.isDeadlinePassed(obj);
      const effectiveOpen = CourseAssignment.isEffectiveSessionOpen(obj);
      return {
        ...obj,
        feedbackDeadline: obj.feedbackDeadline || null,
        isDeadlinePassed,
        manualSessionOpen: obj.isReviewSessionOpen !== false,
        isReviewSessionOpen: effectiveOpen,
        alreadyReviewed: reviewedAssignmentIds.has(a._id.toString())
      };
    });

    res.json(assignmentsWithStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function isRating(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

function normalizeSectionResponses(configuredQuestions, submittedResponses, legacyFallbacks = [], formatText = null) {
  const questions = (configuredQuestions || []).filter(q => q && String(q.text || '').trim());
  const submitted = Array.isArray(submittedResponses) ? submittedResponses : [];
  const normalized = [];

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const resolvedText = formatText ? formatText(q.text, idx) : String(q.text).trim();
    const byId = submitted.find(r => r && r.questionId === q.id);
    const byIdx = submitted[idx];
    const rawScore = byId?.score !== undefined
      ? byId.score
      : (byIdx?.score !== undefined ? byIdx.score : legacyFallbacks[idx]);

    if (!isRating(rawScore)) {
      return {
        valid: false,
        message: `Please answer: "${resolvedText}"`
      };
    }

    normalized.push({
      questionId: q.id || `q_${idx + 1}`,
      questionText: resolvedText,
      score: Number(rawScore)
    });
  }

  return { valid: true, responses: normalized };
}

// Submit feedback (student auth required, but feedback itself is anonymous)
exports.submitFeedback = async (req, res) => {
  try {
    const globalSession = await ReviewSession.getCurrentSession();
    if (!globalSession.isOpen) {
      return res.status(403).json({
        message: globalSession.closedMessage || 'The feedback evaluation period is currently closed.',
        isClosed: true
      });
    }

    const {
      assignmentId,
      teacher,
      department,
      courseName,
      courseContentOrg = {},
      coFeedback = [],
      academicFacilities = {},
      courseTeacherEval = {},
      customSections = []
    } = req.body;

    if (!teacher || !department) {
      return res.status(400).json({ message: 'Teacher and Department are required.' });
    }

    // Eligibility & Deadline check first so expired deadlines immediately return 403
    let targetAssignment = null;
    if (req.studentId) {
      const student = await Student.findById(req.studentId);
      if (student) {
        const rawSeries = String(student.series || (student.roll && student.roll.length >= 2 ? student.roll.substring(0, 2) : '')).trim();
        const digits = rawSeries.replace(/\D/g, '');
        const s2 = digits.length >= 2 ? digits.slice(-2) : rawSeries;
        const seriesVariants = getSeriesMatchVariants(s2 || rawSeries);

        if (assignmentId) {
          targetAssignment = await CourseAssignment.findById(assignmentId);
        } else {
          targetAssignment = await CourseAssignment.findOne({
            isActive: true,
            teacher,
            courseName,
            $or: [
              { series: { $in: seriesVariants } },
              ...(s2 ? [{ series: new RegExp(`(^|\\b|20)?${s2}(\\b|$)`, 'i') }] : [])
            ]
          });
        }

        if (!targetAssignment || !targetAssignment.isActive) {
          return res.status(403).json({ message: 'You are not eligible to review this course/teacher because it is not currently active.' });
        }
        if (CourseAssignment.isDeadlinePassed(targetAssignment)) {
          return res.status(403).json({
            message: 'The feedback deadline for this course has passed. The review session is closed.',
            isClosed: true,
            isDeadlinePassed: true
          });
        }
        if (targetAssignment.isReviewSessionOpen === false) {
          return res.status(403).json({ message: 'The feedback session for this course is currently closed.', isClosed: true });
        }
      }
    } else if (assignmentId) {
      targetAssignment = await CourseAssignment.findById(assignmentId);
      if (targetAssignment && CourseAssignment.isDeadlinePassed(targetAssignment)) {
        return res.status(403).json({
          message: 'The feedback deadline for this course has passed. The review session is closed.',
          isClosed: true,
          isDeadlinePassed: true
        });
      }
    }

    const cfg = await FeedbackConfig.getConfig();
    const clean = (v) => (typeof v === 'string' ? v.trim() : '');

    // 1. Validate Course Content section
    const ccCheck = normalizeSectionResponses(
      cfg.courseContent?.questions,
      courseContentOrg?.responses,
      [courseContentOrg?.q1_upToDate]
    );
    if (!ccCheck.valid) {
      return res.status(400).json({ message: ccCheck.message });
    }

    // 2. Validate CO section(s)
    const coQuestions = cfg.coSection?.questions || [];
    const normalizedCOs = [];
    const submittedCOList = Array.isArray(coFeedback) ? coFeedback : [];

    if (coQuestions.length > 0 && submittedCOList.length > 0) {
      for (const co of submittedCOList) {
        const coNum = Number(co.coNumber) || 1;
        const coCheck = normalizeSectionResponses(
          coQuestions,
          co.responses,
          [co.q1_contentAligned, co.q2_methodsEffective, co.q3_assessmentAppropriate],
          (tmpl) => resolveCOQuestionText(tmpl, coNum)
        );
        if (!coCheck.valid) {
          return res.status(400).json({ message: `CO${coNum}: ${coCheck.message}` });
        }
        normalizedCOs.push({
          coNumber: coNum,
          coTitle: clean(co.coTitle),
          coDescription: clean(co.coDescription),
          responses: coCheck.responses,
          q1_contentAligned: coCheck.responses[0]?.score,
          q2_methodsEffective: coCheck.responses[1]?.score,
          q3_assessmentAppropriate: coCheck.responses[2]?.score,
          comment: clean(co.comment)
        });
      }
    } else if (submittedCOList.length > 0) {
      for (const co of submittedCOList) {
        normalizedCOs.push({
          coNumber: Number(co.coNumber) || 1,
          coTitle: clean(co.coTitle),
          coDescription: clean(co.coDescription),
          responses: [],
          comment: clean(co.comment)
        });
      }
    }

    // 3. Validate Facilities section
    const facCheck = normalizeSectionResponses(
      cfg.facilities?.questions,
      academicFacilities?.responses,
      [academicFacilities?.q1_infrastructure]
    );
    if (!facCheck.valid) {
      return res.status(400).json({ message: facCheck.message });
    }

    // 4. Validate Course Teacher section
    const ctCheck = normalizeSectionResponses(
      cfg.courseTeacher?.questions,
      courseTeacherEval?.responses,
      [courseTeacherEval?.rating]
    );
    if (!ctCheck.valid) {
      return res.status(400).json({ message: ctCheck.message });
    }

    // 5. Validate Custom Sections (if Admin added any)
    const normalizedCustomSections = [];
    const submittedCustomList = Array.isArray(customSections) ? customSections : [];
    for (const cfgSec of (cfg.customSections || [])) {
      const qs = (cfgSec.questions || []).filter(q => q && String(q.text || '').trim());
      if (qs.length === 0) continue;
      const submittedSec = submittedCustomList.find(s => s && s.sectionId === cfgSec.id) || {};
      const customCheck = normalizeSectionResponses(qs, submittedSec.responses, []);
      if (!customCheck.valid) {
        return res.status(400).json({ message: `${cfgSec.title}: ${customCheck.message}` });
      }
      normalizedCustomSections.push({
        sectionId: cfgSec.id,
        sectionTitle: cfgSec.title,
        scaleType: cfgSec.scaleType === 'rating' ? 'rating' : 'likert',
        responses: customCheck.responses,
        comment: clean(submittedSec.comment)
      });
    }

    // Duplicate prevention: check studentId + assignmentId in FeedbackLog
    if (req.studentId && targetAssignment) {
      const existing = await FeedbackLog.findOne({ student: req.studentId, assignment: targetAssignment._id });
      if (existing) {
        return res.status(409).json({ message: 'You have already submitted feedback for this course' });
      }
      await FeedbackLog.create({ student: req.studentId, assignment: targetAssignment._id });
    }

    const feedback = await Feedback.create({
      teacher,
      department,
      courseName: clean(courseName) || targetAssignment?.courseName || 'Course',
      courseContentOrg: {
        responses: ccCheck.responses,
        ...(ccCheck.responses[0] ? { q1_upToDate: ccCheck.responses[0].score } : {}),
        comment: clean(courseContentOrg?.comment),
      },
      coFeedback: normalizedCOs,
      academicFacilities: {
        responses: facCheck.responses,
        ...(facCheck.responses[0] ? { q1_infrastructure: facCheck.responses[0].score } : {}),
        comment: clean(academicFacilities?.comment),
      },
      courseTeacherEval: {
        responses: ctCheck.responses,
        ...(ctCheck.responses[0] ? { rating: ctCheck.responses[0].score } : {}),
        comment: clean(courseTeacherEval?.comment),
      },
      customSections: normalizedCustomSections,
      sentiment: null,
    });

    const allFeedbacks = await Feedback.find({ teacher }).lean();
    const agg = aggregateScores(allFeedbacks);

    await Teacher.findByIdAndUpdate(teacher, {
      avgRating: agg.avgRating,
      avgCourseContent: agg.avgCourseContent,
      avgFacilities: agg.avgFacilities,
      avgCOAttainment: agg.avgCOAttainment,
      avgCourseTeacher: agg.avgCourseTeacher,
      totalFeedbacks: allFeedbacks.length,
    });

    res.status(201).json({ message: 'Feedback submitted successfully!', feedback });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all feedbacks (admin only, paginated)
exports.getFeedbacks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.teacher) filter.teacher = req.query.teacher;
    if (req.query.sentiment) filter.sentiment = req.query.sentiment;

    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter)
        .populate('teacher', 'name designation')
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Feedback.countDocuments(filter),
    ]);

    res.json({
      feedbacks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get feedbacks for a specific teacher
exports.getTeacherFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ teacher: req.params.teacherId })
      .populate('department', 'name code')
      .sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
