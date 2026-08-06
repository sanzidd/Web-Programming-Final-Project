const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const Department = require('../models/Department');

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

    const aggregations = await Feedback.aggregate([
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                totalFeedbacks: { $sum: 1 },
                totalRating: { $sum: "$courseRating.overall" },
              }
            }
          ],
          sentimentCounts: [
            {
              $group: {
                _id: "$sentiment",
                count: { $sum: 1 }
              }
            }
          ],
          ratingDistribution: [
            {
              $group: {
                _id: "$courseRating.overall",
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const aggData = aggregations[0];
    const stats = aggData.stats[0] || { totalFeedbacks: 0, totalRating: 0 };
    const totalFeedbacks = stats.totalFeedbacks;
    const avgRating = totalFeedbacks > 0 ? (stats.totalRating / totalFeedbacks).toFixed(2) : 0;

    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    aggData.sentimentCounts.forEach(s => {
      if (s._id) sentimentCounts[s._id] = s.count;
    });

    const ratingDistMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    aggData.ratingDistribution.forEach(r => {
      if (r._id) ratingDistMap[r._id] = r.count;
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
    
    // Aggregate feedbacks by department
    const aggData = await Feedback.aggregate([
      {
        $group: {
          _id: "$department",
          feedbackCount: { $sum: 1 },
          totalRating: { $sum: "$courseRating.overall" }
        }
      }
    ]);

    // Aggregate teachers by department
    const teacherAgg = await Teacher.aggregate([
      {
        $group: {
          _id: "$department",
          teacherCount: { $sum: 1 }
        }
      }
    ]);

    const feedbackMap = {};
    aggData.forEach(d => {
      if (d._id) {
        feedbackMap[d._id.toString()] = d;
      }
    });

    const teacherMap = {};
    teacherAgg.forEach(t => {
      if (t._id) {
        teacherMap[t._id.toString()] = t.teacherCount;
      }
    });

    const analytics = departments.map(dept => {
      const deptIdStr = dept._id.toString();
      const fbData = feedbackMap[deptIdStr] || { feedbackCount: 0, totalRating: 0 };
      const teacherCount = teacherMap[deptIdStr] || 0;
      
      const avgRating = fbData.feedbackCount > 0 
        ? (fbData.totalRating / fbData.feedbackCount).toFixed(2)
        : 0;

      return {
        department: dept,
        feedbackCount: fbData.feedbackCount,
        teacherCount,
        avgRating: parseFloat(avgRating),
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
    const aggData = await Feedback.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" }
          },
          totalRating: { $sum: "$courseRating.overall" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const trends = aggData.map(m => ({
      month: m._id,
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
