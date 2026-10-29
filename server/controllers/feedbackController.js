const crypto = require('crypto');
const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const FeedbackLog = require('../models/FeedbackLog');
const CourseAssignment = require('../models/CourseAssignment');
const Student = require('../models/Student');
const Department = require('../models/Department');
const ReviewSession = require('../models/ReviewSession');
const { aggregateScores } = require('../utils/feedbackScores');

/**
 * Helper to generate all common variants of a series string
 * e.g., "22" -> ["22", "2022", "Series 22", "series 22", "Series 2022", "series 2022", "all", "*"]
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

    // Extract series cleanly (2-digit and 4-digit)
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

    // Verify student department is valid in DB (not orphaned or null)
    let studentDeptId = student.department;
    if (studentDeptId) {
      const deptExists = await Department.findById(studentDeptId);
      if (!deptExists) studentDeptId = null;
    }

    // Auto-heal department and series if missing using RUET roll convention (YYDDNNN)
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
      // Primary query: courses for student's department and series
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

    // Fallback: Only if student has no registered department set,
    // look up any active courses matching this student's series
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
      return {
        ...obj,
        isReviewSessionOpen: obj.isReviewSessionOpen !== false,
        alreadyReviewed: reviewedAssignmentIds.has(a._id.toString())
      };
    });

    res.json(assignmentsWithStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit feedback (student auth required, but feedback itself is anonymous)
exports.submitFeedback = async (req, res) => {
  try {
    // Global Review Session check
    const globalSession = await ReviewSession.getCurrentSession();
    if (!globalSession.isOpen) {
      return res.status(403).json({
        message: globalSession.closedMessage || 'The feedback evaluation period is currently closed.',
        isClosed: true
      });
    }

    const { 
      assignmentId, teacher, department, courseName, 
      courseContentOrg, coFeedback, academicFacilities, courseTeacherEval
    } = req.body;

    // Validate main nested objects
    const missing = [];
    if (!teacher) missing.push('teacher');
    if (!department) missing.push('department');
    if (!courseContentOrg) missing.push('courseContentOrg');
    if (!academicFacilities) missing.push('academicFacilities');
    if (!courseTeacherEval) missing.push('courseTeacherEval');

    if (missing.length > 0) {
      return res.status(400).json({ message: 'All feedback sections are required. Missing: ' + missing.join(', ') });
    }

    const isRating = (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 5;

    // Course Content & Organisation
    if (!isRating(courseContentOrg.q1_upToDate)) {
      return res.status(400).json({ message: 'Please answer the Course Content & Organisation question' });
    }

    // CO feedback
    if (Array.isArray(coFeedback)) {
      for (const co of coFeedback) {
        if (!isRating(co.q1_contentAligned) || !isRating(co.q2_methodsEffective) || !isRating(co.q3_assessmentAppropriate)) {
          return res.status(400).json({ message: `All questions for CO${co.coNumber} are required` });
        }
      }
    }

    // Academic & Laboratory Facilities
    if (!isRating(academicFacilities.q1_infrastructure)) {
      return res.status(400).json({ message: 'Please answer the Academic & Laboratory Facilities question' });
    }

    // Course Teacher
    if (!isRating(courseTeacherEval.rating)) {
      return res.status(400).json({ message: 'Please rate the Course Teacher (1-5)' });
    }

    // Eligibility check: Ensure assignment exists and is active
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
        if (targetAssignment.isReviewSessionOpen === false) {
          return res.status(403).json({ message: 'The feedback session for this course is currently closed.', isClosed: true });
        }
      }
    }

    // Duplicate prevention: check studentId + assignmentId in FeedbackLog
    // This allows tracking who gave feedback for a course without linking it to the feedback content
    if (req.studentId && targetAssignment) {
      const existing = await FeedbackLog.findOne({ student: req.studentId, assignment: targetAssignment._id });
      if (existing) {
        console.warn(`[409] Duplicate submission prevented for student: ${req.studentId}, assignment: ${targetAssignment._id}`);
        return res.status(409).json({ message: 'You have already submitted feedback for this course' });
      }
      await FeedbackLog.create({ student: req.studentId, assignment: targetAssignment._id });
    }

    const clean = (v) => (typeof v === 'string' ? v.trim() : '');

    const feedback = await Feedback.create({
      teacher, department, courseName,
      courseContentOrg: {
        q1_upToDate: Number(courseContentOrg.q1_upToDate),
        comment: clean(courseContentOrg.comment),
      },
      coFeedback: (Array.isArray(coFeedback) ? coFeedback : []).map(co => ({
        coNumber: co.coNumber,
        coTitle: co.coTitle || '',
        coDescription: co.coDescription || '',
        q1_contentAligned: Number(co.q1_contentAligned),
        q2_methodsEffective: Number(co.q2_methodsEffective),
        q3_assessmentAppropriate: Number(co.q3_assessmentAppropriate),
        comment: clean(co.comment),
      })),
      academicFacilities: {
        q1_infrastructure: Number(academicFacilities.q1_infrastructure),
        comment: clean(academicFacilities.comment),
      },
      courseTeacherEval: {
        rating: Number(courseTeacherEval.rating),
        comment: clean(courseTeacherEval.comment),
      },
      sentiment: null,
    });

    // Update teacher averages (supports both current and legacy feedback fields)
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
