const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const Department = require('../models/Department');
const { feedbackAverage, aggregateScores, enrichFeedbackForDisplay } = require('../utils/feedbackScores');

// Overall average for a single feedback (current + legacy fields)
function calcFeedbackAvg(f) {
  return feedbackAverage(f);
}

// Overview stats
exports.getOverview = async (req, res) => {
  try {
    const [totalTeachers, totalDepartments, recentFeedbacks] = await Promise.all([
      Teacher.countDocuments(),
      Department.countDocuments(),
      Feedback.find()
        .populate('teacher', 'name designation')
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const totalFeedbacks = await Feedback.countDocuments();

    // Compute overall average and distribution from all sections
    const feedbacksForAvg = await Feedback.find().lean();
    let totalAvg = 0;
    let validCount = 0;
    const ratingDistMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    feedbacksForAvg.forEach(f => {
      const fbAvg = calcFeedbackAvg(f);
      if (fbAvg !== null) {
        totalAvg += fbAvg;
        validCount++;
        const rounded = Math.round(fbAvg);
        if (rounded >= 1 && rounded <= 5) ratingDistMap[rounded]++;
      }
    });

    const avgRating = validCount > 0 ? (totalAvg / validCount).toFixed(2) : 0;

    // Sentiment counts
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    feedbacksForAvg.forEach(f => {
      if (f.sentiment) sentimentCounts[f.sentiment]++;
    });

    const ratingDist = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: ratingDistMap[rating],
      label: `${rating} Star${rating > 1 ? 's' : ''}`
    }));

    res.json({
      totalFeedbacks,
      totalTeachers,
      totalDepartments,
      avgRating: parseFloat(avgRating),
      sentimentCounts,
      ratingDistribution: ratingDist,
      recentFeedbacks: recentFeedbacks.map(enrichFeedbackForDisplay),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Department-wise analytics
exports.getDepartmentAnalytics = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    
    // Get all feedbacks
    const allFeedbacks = await Feedback.find().lean();

    // Aggregate teachers by department
    const teacherAgg = await Teacher.aggregate([
      { $group: { _id: "$department", teacherCount: { $sum: 1 } } }
    ]);

    const teacherMap = {};
    teacherAgg.forEach(t => {
      if (t._id) teacherMap[t._id.toString()] = t.teacherCount;
    });

    const analytics = departments.map(dept => {
      const deptIdStr = dept._id.toString();
      const deptFeedbacks = allFeedbacks.filter(f => f.department?.toString() === deptIdStr);
      const teacherCount = teacherMap[deptIdStr] || 0;

      let totalAvg = 0;
      let validCount = 0;
      deptFeedbacks.forEach(f => {
        const fbAvg = calcFeedbackAvg(f);
        if (fbAvg !== null) {
          totalAvg += fbAvg;
          validCount++;
        }
      });

      const avgRating = validCount > 0 ? parseFloat((totalAvg / validCount).toFixed(2)) : 0;

      return {
        department: dept,
        feedbackCount: deptFeedbacks.length,
        teacherCount,
        avgRating,
      };
    });

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Trends over time (monthly)
exports.getTrends = async (req, res) => {
  try {
    const allFeedbacks = await Feedback.find().lean();

    const monthlyData = {};
    allFeedbacks.forEach(f => {
      const key = `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, totalAvg: 0, count: 0 };
      }

      const fbAvg = calcFeedbackAvg(f);
      if (fbAvg !== null) {
        monthlyData[key].totalAvg += fbAvg;
        monthlyData[key].count++;
      }
    });

    const trends = Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: m.month,
        avgRating: parseFloat((m.totalAvg / m.count).toFixed(2)),
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
        monthlyData[key] = { month: key, totalAvg: 0, count: 0 };
      }
      const fbAvg = calcFeedbackAvg(f);
      if (fbAvg !== null) {
        monthlyData[key].totalAvg += fbAvg;
        monthlyData[key].count++;
      }
    });

    const trends = Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: m.month,
        avgRating: parseFloat((m.totalAvg / m.count).toFixed(2)),
        feedbackCount: m.count,
      }));

    // Live section averages across all feedbacks for this teacher
    const liveAgg = feedbacks.length > 0 ? aggregateScores(feedbacks) : null;
    const teacherObj = teacher.toObject();
    if (liveAgg) {
      teacherObj.avgRating = liveAgg.avgRating;
      teacherObj.avgCourseContent = liveAgg.avgCourseContent;
      teacherObj.avgCOAttainment = liveAgg.avgCOAttainment;
      teacherObj.avgFacilities = liveAgg.avgFacilities;
      teacherObj.avgCourseTeacher = liveAgg.avgCourseTeacher;
      teacherObj.totalFeedbacks = feedbacks.length;
    }

    // Criteria breakdown
    const criteriaRadar = [
      { criteria: 'Overall', value: teacherObj.avgRating || 0 },
      { criteria: 'Course Content', value: teacherObj.avgCourseContent || 0 },
      { criteria: 'CO Attainment', value: teacherObj.avgCOAttainment || 0 },
      { criteria: 'Facilities', value: teacherObj.avgFacilities || 0 },
      { criteria: 'Course Teacher', value: teacherObj.avgCourseTeacher || 0 },
    ];

    // Sentiment breakdown
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    feedbacks.forEach(f => { if (f.sentiment) sentimentCounts[f.sentiment]++; });

    // Rating distribution
    const ratingDist = [0, 0, 0, 0, 0];
    feedbacks.forEach(f => { 
      const fbAvg = calcFeedbackAvg(f);
      if (fbAvg !== null) {
        const overall = Math.round(fbAvg);
        if (overall >= 1 && overall <= 5) ratingDist[overall - 1]++;
      }
    });

    res.json({
      teacher: teacherObj,
      feedbacks: feedbacks.map(enrichFeedbackForDisplay),
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
    
    let totalAvg = 0;
    let validCount = 0;
    feedbacks.forEach(f => {
      const fbAvg = calcFeedbackAvg(f);
      if (fbAvg !== null) {
        totalAvg += fbAvg;
        validCount++;
      }
    });
    const avgRating = validCount > 0 ? parseFloat((totalAvg / validCount).toFixed(2)) : 0;

    // Sentiment breakdown
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    feedbacks.forEach(f => { if(f.sentiment) sentimentCounts[f.sentiment]++; });

    res.json({
      department,
      feedbackCount: feedbacks.length,
      teacherCount,
      avgRating,
      sentimentCounts,
      feedbacks
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
