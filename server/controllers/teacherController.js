const Teacher = require('../models/Teacher');

// Get all teachers (optionally filter by department)
exports.getTeachers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) {
      filter.department = req.query.department;
    }
    const teachers = await Teacher.find(filter)
      .populate('department', 'name code')
      .sort({ name: 1 });
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single teacher with details
exports.getTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('department', 'name code');
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get top rated teachers
exports.getTopTeachers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const teachers = await Teacher.find({ totalFeedbacks: { $gt: 0 } })
      .populate('department', 'name code')
      .sort({ avgRating: -1 })
      .limit(limit);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get bottom rated teachers
exports.getBottomTeachers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const teachers = await Teacher.find({ totalFeedbacks: { $gt: 0 } })
      .populate('department', 'name code')
      .sort({ avgRating: 1 })
      .limit(limit);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
