const crypto = require('crypto');
const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const FeedbackLog = require('../models/FeedbackLog');
const CourseAssignment = require('../models/CourseAssignment');
const Student = require('../models/Student');
const ReviewSession = require('../models/ReviewSession');

// Simple sentiment analysis based on keywords
function analyzeSentiment(text) {
  if (!text || text.trim().length === 0) return 'neutral';
  const lower = text.toLowerCase();
  const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'best', 'love', 
    'helpful', 'outstanding', 'brilliant', 'good', 'nice', 'awesome', 'perfect', 'superb', 
    'thank', 'appreciate', 'clear', 'engaging', 'inspiring', 'dedicated', 'supportive',
    'knowledgeable', 'patient', 'friendly', 'recommend', 'impressive', 'exceptional'];
  const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'poor', 'horrible', 'hate', 
    'boring', 'confusing', 'unclear', 'rude', 'unhelpful', 'lazy', 'difficult', 'waste',
    'disappointed', 'frustrating', 'unfair', 'disorganized', 'unprepared', 'arrogant',
    'incompetent', 'biased', 'careless', 'unprofessional'];

  let posScore = 0, negScore = 0;
  positiveWords.forEach(w => { if (lower.includes(w)) posScore++; });
  negativeWords.forEach(w => { if (lower.includes(w)) negScore++; });

  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}

// Collect all comment text from a feedback for sentiment analysis
function collectAllComments(body) {
  const comments = [];
  if (body.courseContentOrg?.comment) comments.push(body.courseContentOrg.comment);
  if (body.teachingLearning?.comment) comments.push(body.teachingLearning.comment);
  if (body.academicFacilities?.comment) comments.push(body.academicFacilities.comment);
  if (Array.isArray(body.coFeedback)) {
    body.coFeedback.forEach(co => {
      if (co.comment) comments.push(co.comment);
    });
  }
  return comments.join(' ');
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

    const filter = { isActive: true };
    const derivedSeries = student.roll ? student.roll.substring(0, 2) : '';
    
    if (derivedSeries) {
      filter.$or = [
        { series: derivedSeries },
        { series: 'all' },
        { series: '*' },
        { series: '' }
      ];
    }

    const assignments = await CourseAssignment.find(filter)
      .populate('department', 'name code')
      .populate('teacher', 'name designation email courses')
      .sort({ courseCode: 1, courseName: 1 });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit feedback (student auth required, but feedback itself is anonymous)
exports.submitFeedback = async (req, res) => {
  try {
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

    // Eligibility check: Ensure assignment exists for this course/teacher, department, and series
    let targetAssignment = null;
    if (req.studentId) {
      const student = await Student.findById(req.studentId);
      if (student) {
        const derivedSeries = student.roll ? student.roll.substring(0, 2) : '';
        targetAssignment = await CourseAssignment.findOne({
          _id: assignmentId,
          isActive: true,
          teacher,
          department, // use the department submitted in the form
          $or: [
            { series: derivedSeries },
            { series: 'all' },
            { series: '*' },
            { series: '' }
          ]
        });
        if (!targetAssignment) {
          return res.status(403).json({ message: 'You are not eligible to review this course/teacher because it is not assigned to your enrolled series/department.' });
        }
        if (!targetAssignment.isReviewSessionOpen) {
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

    const allComments = collectAllComments(req.body);
    const sentiment = (allComments && allComments.trim().length > 0) ? analyzeSentiment(allComments) : null;

    const feedback = await Feedback.create({
      teacher, department, courseName,
      courseContentOrg,
      coFeedback: coFeedback || [],
      teachingLearning,
      academicFacilities,
      sentiment: sentiment || null,
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
