const crypto = require('crypto');
const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const FeedbackLog = require('../models/FeedbackLog');
const CourseAssignment = require('../models/CourseAssignment');
const Student = require('../models/Student');
const Department = require('../models/Department');
const ReviewSession = require('../models/ReviewSession');

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
      courseContentOrg, coFeedback, teachingLearning, academicFacilities
    } = req.body;

    // Validate main nested objects
    const missing = [];
    if (!teacher) missing.push('teacher');
    if (!department) missing.push('department');
    if (!courseContentOrg) missing.push('courseContentOrg');
    if (!teachingLearning) missing.push('teachingLearning');
    if (!academicFacilities) missing.push('academicFacilities');

    if (missing.length > 0) {
      console.error("VALIDATION FAILED. Missing:", missing);
      console.error("Payload:", JSON.stringify(req.body, null, 2));
      return res.status(400).json({ message: 'All feedback sections are required. Missing: ' + missing.join(', ') });
    }

    // Validate courseContentOrg fields
    if (!courseContentOrg.q1_objectives || !courseContentOrg.q2_workload || !courseContentOrg.q3_organized) {
      return res.status(400).json({ message: 'All Course Content & Organisation questions are required' });
    }

    // Validate teachingLearning fields
    if (!teachingLearning.q1_structured || !teachingLearning.q2_participation || 
        !teachingLearning.q3_materials || !teachingLearning.q4_assessment) {
      return res.status(400).json({ message: 'All Teaching-Learning & Assessment questions are required' });
    }

    // Validate academicFacilities fields
    if (!academicFacilities.q1_environment || !academicFacilities.q2_classrooms || !academicFacilities.q3_laboratory) {
      return res.status(400).json({ message: 'All Academic & Laboratory Facilities questions are required' });
    }

    // Validate CO feedback if provided
    if (Array.isArray(coFeedback)) {
      for (const co of coFeedback) {
        if (!co.q1_achievement || !co.q2_alignment || !co.q3_assessment) {
          return res.status(400).json({ message: `All questions for CO${co.coNumber} are required` });
        }
      }
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

    const feedback = await Feedback.create({
      teacher, department, courseName,
      courseContentOrg,
      coFeedback: coFeedback || [],
      teachingLearning,
      academicFacilities,
      sentiment: null,
    });

    // Update teacher averages
    const allFeedbacks = await Feedback.find({ teacher }).lean();

    function safeNum(val) {
      const n = Number(val);
      return (!isNaN(n) && isFinite(n) && n > 0) ? n : null;
    }

    let totalContentScore = 0, contentCount = 0;
    let totalTLScore = 0, tlCount = 0;
    let totalFacScore = 0, facCount = 0;
    let totalCOScore = 0, coCount = 0;

    allFeedbacks.forEach(f => {
      // Course Content & Organisation (support new and legacy fields)
      const c = f.courseContentOrg || f.courseContent;
      if (c) {
        const q1 = safeNum(c.q1_objectives || c.q1);
        const q2 = safeNum(c.q2_workload || c.q2);
        const q3 = safeNum(c.q3_organized || c.q3);
        const valid = [q1, q2, q3].filter(v => v !== null);
        if (valid.length > 0) {
          totalContentScore += valid.reduce((a, b) => a + b, 0) / valid.length;
          contentCount++;
        }
      }

      // Teaching-Learning & Assessment (support new and legacy fields)
      const tl = f.teachingLearning || f.learningEnvironment;
      if (tl) {
        const q1 = safeNum(tl.q1_structured || tl.q8);
        const q2 = safeNum(tl.q2_participation || tl.q9);
        const q3 = safeNum(tl.q3_materials || f.learningResources?.q13);
        const q4 = safeNum(tl.q4_assessment || f.courseTeacher?.q18);
        const valid = [q1, q2, q3, q4].filter(v => v !== null);
        if (valid.length > 0) {
          totalTLScore += valid.reduce((a, b) => a + b, 0) / valid.length;
          tlCount++;
        }
      }

      // Academic and Lab Facilities (support new and legacy fields)
      const af = f.academicFacilities || f.learningResources;
      if (af) {
        const q1 = safeNum(af.q1_environment || f.learningEnvironment?.q10);
        const q2 = safeNum(af.q2_classrooms || f.learningEnvironment?.q11);
        const q3 = safeNum(af.q3_laboratory || af.q15);
        const valid = [q1, q2, q3].filter(v => v !== null);
        if (valid.length > 0) {
          totalFacScore += valid.reduce((a, b) => a + b, 0) / valid.length;
          facCount++;
        }
      }

      // CO feedback
      if (Array.isArray(f.coFeedback) && f.coFeedback.length > 0) {
        f.coFeedback.forEach(co => {
          const q1 = safeNum(co.q1_achievement);
          if (q1 !== null) {
            totalCOScore += q1;
            coCount++;
          }
        });
      }
    });

    const avgCourseContent = contentCount > 0 ? totalContentScore / contentCount : 0;
    const avgTeachingLearning = tlCount > 0 ? totalTLScore / tlCount : 0;
    const avgFacilities = facCount > 0 ? totalFacScore / facCount : 0;
    const avgCOAttainment = coCount > 0 ? totalCOScore / coCount : 0;

    const sections = [avgCourseContent, avgTeachingLearning, avgFacilities].filter(v => v > 0);
    if (avgCOAttainment > 0) sections.push(avgCOAttainment);

    const rawAvg = sections.length > 0 ? sections.reduce((a, b) => a + b, 0) / sections.length : 0;
    const avgRating = (!isNaN(rawAvg) && isFinite(rawAvg)) ? Math.round(rawAvg * 100) / 100 : 0;

    await Teacher.findByIdAndUpdate(teacher, {
      avgRating,
      avgCourseContent: (!isNaN(avgCourseContent) && isFinite(avgCourseContent)) ? Math.round(avgCourseContent * 100) / 100 : 0,
      avgTeachingLearning: (!isNaN(avgTeachingLearning) && isFinite(avgTeachingLearning)) ? Math.round(avgTeachingLearning * 100) / 100 : 0,
      avgFacilities: (!isNaN(avgFacilities) && isFinite(avgFacilities)) ? Math.round(avgFacilities * 100) / 100 : 0,
      avgCOAttainment: (!isNaN(avgCOAttainment) && isFinite(avgCOAttainment)) ? Math.round(avgCOAttainment * 100) / 100 : 0,
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
