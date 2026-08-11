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
      courseContent, studentContribution, learningEnvironment, learningResources, courseTeacher,
      courseRating, overallFeedback
    } = req.body;


    // Validate main nested objects
    const missing = [];
    if (!teacher) missing.push('teacher');
    if (!department) missing.push('department');
    if (!courseContent) missing.push('courseContent');
    if (!studentContribution) missing.push('studentContribution');
    if (!learningEnvironment) missing.push('learningEnvironment');
    if (!learningResources) missing.push('learningResources');
    if (!courseTeacher) missing.push('courseTeacher');
    if (!courseRating) missing.push('courseRating');

    if (missing.length > 0) {
      console.error("VALIDATION FAILED. Missing:", missing);
      console.error("Payload:", JSON.stringify(req.body, null, 2));
      return res.status(400).json({ message: 'All feedback sections are required. Missing: ' + missing.join(', ') });
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

    const sentiment = analyzeSentiment(overallFeedback);

    const feedback = await Feedback.create({
      teacher, department, courseName,
      courseContent, studentContribution, learningEnvironment, learningResources, courseTeacher,
      courseRating, overallFeedback,
      sentiment,
    });

    // Update teacher averages
    const allFeedbacks = await Feedback.find({ teacher });
    const ratedFeedbacks = allFeedbacks.filter(f => f.courseRating && typeof f.courseRating.overall === 'number');
    const count = ratedFeedbacks.length || 1; // Prevent division by zero
    
    const avgRating = ratedFeedbacks.reduce((sum, f) => sum + f.courseRating.overall, 0) / count;
    const avgStructure = ratedFeedbacks.reduce((sum, f) => sum + f.courseRating.structure, 0) / count;
    const avgDelivery = ratedFeedbacks.reduce((sum, f) => sum + f.courseRating.delivery, 0) / count;
    const avgDuration = ratedFeedbacks.reduce((sum, f) => sum + f.courseRating.duration, 0) / count;
    const avgEnvironment = ratedFeedbacks.reduce((sum, f) => sum + f.courseRating.environment, 0) / count;
    const avgSkill = ratedFeedbacks.reduce((sum, f) => sum + f.courseRating.skill, 0) / count;

    await Teacher.findByIdAndUpdate(teacher, {
      avgRating: Math.round(avgRating * 100) / 100,
      avgStructure: Math.round(avgStructure * 100) / 100,
      avgDelivery: Math.round(avgDelivery * 100) / 100,
      avgDuration: Math.round(avgDuration * 100) / 100,
      avgEnvironment: Math.round(avgEnvironment * 100) / 100,
      avgSkill: Math.round(avgSkill * 100) / 100,
      totalFeedbacks: count,
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
    if (req.query.minRating) filter['courseRating.overall'] = { $gte: parseInt(req.query.minRating) };

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
