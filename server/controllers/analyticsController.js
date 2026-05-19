const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const Department = require('../models/Department');

// Overview stats
exports.getOverview = async (req, res) => {
  try {
    const [totalFeedbacks, totalTeachers, totalDepartments, feedbacks] = await Promise.all([
      Feedback.countDocuments(),
      Teacher.countDocuments(),
      Department.countDocuments(),
      Feedback.find(),
    ]);

    const avgRating = totalFeedbacks > 0
      ? (feedbacks.reduce((sum, f) => sum + (f.courseRating?.overall || 0), 0) / totalFeedbacks).toFixed(2)
      : 0;

    // Sentiment distribution
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    feedbacks.forEach(f => { sentimentCounts[f.sentiment]++; });

    // Rating distribution
    const ratingDist = [0, 0, 0, 0, 0];
    feedbacks.forEach(f => { 
      if (f.courseRating?.overall) ratingDist[f.courseRating.overall - 1]++; 
    });

    // Recent 10 feedbacks
    const recentFeedbacks = await Feedback.find()
      .populate('teacher', 'name designation')
      .populate('department', 'name code')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      totalFeedbacks,
      totalTeachers,
      totalDepartments,
      avgRating: parseFloat(avgRating),
      sentimentCounts,
      ratingDistribution: ratingDist.map((count, i) => ({
        rating: i + 1,
        count,
        label: `${i + 1} Star${i > 0 ? 's' : ''}`,
      })),
      recentFeedbacks,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Department-wise analytics
exports.getDepartmentAnalytics = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    const analytics = [];

    for (const dept of departments) {
      const feedbacks = await Feedback.find({ department: dept._id });
      const teacherCount = await Teacher.countDocuments({ department: dept._id });
      const count = feedbacks.length;
      const avgRating = count > 0
        ? (feedbacks.reduce((sum, f) => sum + (f.courseRating?.overall || 0), 0) / count).toFixed(2)
        : 0;

      analytics.push({
        department: dept,
        feedbackCount: count,
        teacherCount,
        avgRating: parseFloat(avgRating),
      });
    }

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Trends over time (monthly)
exports.getTrends = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: 1 });
    const monthlyData = {};

    feedbacks.forEach(f => {
      const key = `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, totalRating: 0, count: 0 };
      }
      monthlyData[key].totalRating += (f.courseRating?.overall || 0);
      monthlyData[key].count++;
    });

    const trends = Object.values(monthlyData).map(m => ({
      month: m.month,
      avgRating: parseFloat((m.totalRating / m.count).toFixed(2)),
      feedbackCount: m.count,
    }));

    res.json(trends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Teacher analytics
exports.getTeacherAnalytics = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('department', 'name code');
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    const feedbacks = await Feedback.find({ teacher: req.params.id })
      .sort({ createdAt: -1 });

    // Monthly trend for this teacher
    const monthlyData = {};
    feedbacks.forEach(f => {
      const key = `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, totalRating: 0, count: 0 };
      }
      monthlyData[key].totalRating += (f.courseRating?.overall || 0);
      monthlyData[key].count++;
    });

    const trends = Object.values(monthlyData).map(m => ({
      month: m.month,
      avgRating: parseFloat((m.totalRating / m.count).toFixed(2)),
      feedbackCount: m.count,
    }));

    // Criteria breakdown (updated based on new Teacher schema)
    const criteriaRadar = [
      { criteria: 'Overall', value: teacher.avgRating },
      { criteria: 'Structure', value: teacher.avgStructure },
      { criteria: 'Delivery', value: teacher.avgDelivery },
      { criteria: 'Environment', value: teacher.avgEnvironment },
      { criteria: 'Skill', value: teacher.avgSkill },
    ];

    // Sentiment breakdown
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    feedbacks.forEach(f => { sentimentCounts[f.sentiment]++; });

    // Rating distribution
    const ratingDist = [0, 0, 0, 0, 0];
    feedbacks.forEach(f => { 
      if (f.courseRating?.overall) ratingDist[f.courseRating.overall - 1]++; 
    });

    res.json({
      teacher,
      feedbacks,
      trends,
      criteriaRadar,
      sentimentCounts,
      ratingDistribution: ratingDist.map((count, i) => ({
        rating: i + 1,
        count,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Single Department analytics
exports.getSingleDepartmentAnalytics = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: 'Department not found' });

    const feedbacks = await Feedback.find({ department: req.params.id }).sort({ createdAt: -1 });
    const teacherCount = await Teacher.countDocuments({ department: req.params.id });
    
    const ratedFeedbacks = feedbacks.filter(f => f.courseRating && typeof f.courseRating.overall === 'number');
    const count = ratedFeedbacks.length || 1;
    const avgRating = ratedFeedbacks.length > 0 
      ? (ratedFeedbacks.reduce((sum, f) => sum + f.courseRating.overall, 0) / count).toFixed(2)
      : 0;

    // Sentiment breakdown
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    feedbacks.forEach(f => { if(f.sentiment) sentimentCounts[f.sentiment]++; });

    res.json({
      department,
      feedbackCount: feedbacks.length,
      teacherCount,
      avgRating: parseFloat(avgRating),
      sentimentCounts,
      feedbacks
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
