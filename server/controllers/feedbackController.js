const crypto = require('crypto');
const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const FeedbackLog = require('../models/FeedbackLog');

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

// Submit feedback (student auth required, but feedback itself is anonymous)
exports.submitFeedback = async (req, res) => {
  try {
    const { teacher, department, courseName, rating, teachingQuality, communication, helpfulness, comment } = req.body;

    // Validate
    if (!teacher || !department || !rating || !teachingQuality || !communication || !helpfulness) {
      return res.status(400).json({ message: 'All rating fields are required' });
    }

    // Duplicate prevention: hash studentId + teacherId
    // This hash cannot be reversed to identify who gave what feedback
    if (req.studentId) {
      const hashInput = `${req.studentId}-${teacher}`;
      const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
      const existing = await FeedbackLog.findOne({ hash });
      if (existing) {
        return res.status(409).json({ message: 'You have already submitted feedback for this teacher' });
      }
      // Store the hash (not the raw studentId)
      await FeedbackLog.create({ hash });
    }

    const sentiment = analyzeSentiment(comment);

    const feedback = await Feedback.create({
      teacher, department, courseName,
      rating, teachingQuality, communication, helpfulness,
      comment: comment || '',
      sentiment,
    });

    // Update teacher averages
    const allFeedbacks = await Feedback.find({ teacher });
    const count = allFeedbacks.length;
    const avgRating = allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / count;
    const avgTeaching = allFeedbacks.reduce((sum, f) => sum + f.teachingQuality, 0) / count;
    const avgCommunication = allFeedbacks.reduce((sum, f) => sum + f.communication, 0) / count;
    const avgHelpfulness = allFeedbacks.reduce((sum, f) => sum + f.helpfulness, 0) / count;

    await Teacher.findByIdAndUpdate(teacher, {
      avgRating: Math.round(avgRating * 100) / 100,
      avgTeaching: Math.round(avgTeaching * 100) / 100,
      avgCommunication: Math.round(avgCommunication * 100) / 100,
      avgHelpfulness: Math.round(avgHelpfulness * 100) / 100,
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
    if (req.query.minRating) filter.rating = { $gte: parseInt(req.query.minRating) };

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
