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

// Create a new teacher (Admin only)
exports.createTeacher = async (req, res) => {
  try {
    const { name, designation, department, email, photoUrl, courses } = req.body;
    if (!name || !designation || !department) {
      return res.status(400).json({ message: 'Name, designation, and department are required' });
    }

    const newTeacher = await Teacher.create({
      name: name.trim(),
      designation: designation.trim(),
      department,
      email: email ? email.trim().toLowerCase() : '',
      photoUrl: photoUrl || '',
      courses: Array.isArray(courses) ? courses : (typeof courses === 'string' && courses ? courses.split(',').map(c => c.trim()) : [])
    });

    const populated = await Teacher.findById(newTeacher._id).populate('department', 'name code');
    res.status(201).json({ message: 'Teacher created successfully', teacher: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a teacher (Admin only)
exports.updateTeacher = async (req, res) => {
  try {
    const { name, designation, department, email, photoUrl, courses } = req.body;
    const teacherDoc = await Teacher.findById(req.params.id);
    if (!teacherDoc) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (name !== undefined) teacherDoc.name = name.trim();
    if (designation !== undefined) teacherDoc.designation = designation.trim();
    if (department !== undefined) teacherDoc.department = department;
    if (email !== undefined) teacherDoc.email = email.trim().toLowerCase();
    if (photoUrl !== undefined) teacherDoc.photoUrl = photoUrl;
    if (courses !== undefined) {
      teacherDoc.courses = Array.isArray(courses) ? courses : (typeof courses === 'string' && courses ? courses.split(',').map(c => c.trim()) : []);
    }

    await teacherDoc.save();

    // Sync TeacherUser if name/designation/department/email changed
    const TeacherUser = require('../models/TeacherUser');
    const teacherUser = await TeacherUser.findOne({ teacher: teacherDoc._id });
    if (teacherUser) {
      if (name !== undefined) teacherUser.name = teacherDoc.name;
      if (email !== undefined) teacherUser.email = teacherDoc.email;
      if (designation !== undefined) teacherUser.designation = teacherDoc.designation;
      if (department !== undefined) teacherUser.department = teacherDoc.department;
      await teacherUser.save();
    }

    const populated = await Teacher.findById(teacherDoc._id).populate('department', 'name code');
    res.json({ message: 'Teacher updated successfully', teacher: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a teacher (Admin only)
exports.deleteTeacher = async (req, res) => {
  try {
    const teacherDoc = await Teacher.findById(req.params.id);
    if (!teacherDoc) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    await Teacher.findByIdAndDelete(req.params.id);

    // Clean up CourseAssignment and TeacherUser linked to this teacher
    const CourseAssignment = require('../models/CourseAssignment');
    const TeacherUser = require('../models/TeacherUser');
    await CourseAssignment.deleteMany({ teacher: req.params.id });
    await TeacherUser.deleteMany({ teacher: req.params.id });

    res.json({ message: 'Teacher and associated records deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
