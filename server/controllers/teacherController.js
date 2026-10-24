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

    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (cleanEmail) {
      const existingTeacher = await Teacher.findOne({ email: cleanEmail });
      if (existingTeacher) {
        return res.status(400).json({ message: `A teacher with email "${cleanEmail}" already exists in the faculty directory.` });
      }
    }

    const newTeacher = await Teacher.create({
      name: name.trim(),
      designation: designation.trim(),
      department,
      email: cleanEmail,
      photoUrl: photoUrl || '',
      courses: Array.isArray(courses) ? courses : (typeof courses === 'string' && courses ? courses.split(',').map(c => c.trim()) : [])
    });

    // Auto-create or link TeacherUser auth account
    if (cleanEmail) {
      const TeacherUser = require('../models/TeacherUser');
      let teacherUser = await TeacherUser.findOne({ email: cleanEmail });
      if (teacherUser) {
        teacherUser.name = newTeacher.name;
        teacherUser.department = newTeacher.department;
        teacherUser.designation = newTeacher.designation;
        teacherUser.teacher = newTeacher._id;
        teacherUser.isVerified = true;
        teacherUser.isApproved = true;
        await teacherUser.save();
      } else {
        await TeacherUser.create({
          name: newTeacher.name,
          email: cleanEmail,
          password: '12345678',
          department: newTeacher.department,
          designation: newTeacher.designation,
          teacher: newTeacher._id,
          isVerified: true,
          isApproved: true,
          forcePasswordChange: true
        });
      }
    }

    const populated = await Teacher.findById(newTeacher._id).populate('department', 'name code');
    res.status(201).json({ message: 'Teacher created successfully and login synced', teacher: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a teacher (Admin only) - Updates email & profile across the entire system
exports.updateTeacher = async (req, res) => {
  try {
    const { name, designation, department, email, photoUrl, courses } = req.body;
    const teacherDoc = await Teacher.findById(req.params.id);
    if (!teacherDoc) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const oldEmail = teacherDoc.email ? teacherDoc.email.trim().toLowerCase() : '';
    const newEmail = email !== undefined ? (email ? email.trim().toLowerCase() : '') : oldEmail;

    if (newEmail && newEmail !== oldEmail) {
      const existingTeacher = await Teacher.findOne({ email: newEmail, _id: { $ne: teacherDoc._id } });
      if (existingTeacher) {
        return res.status(400).json({ message: `A teacher with email "${newEmail}" already exists in the faculty directory.` });
      }
    }

    if (name !== undefined) teacherDoc.name = name.trim();
    if (designation !== undefined) teacherDoc.designation = designation.trim();
    if (department !== undefined) teacherDoc.department = department;
    if (email !== undefined) teacherDoc.email = newEmail;
    if (photoUrl !== undefined) teacherDoc.photoUrl = photoUrl;
    if (courses !== undefined) {
      teacherDoc.courses = Array.isArray(courses) ? courses : (typeof courses === 'string' && courses ? courses.split(',').map(c => c.trim()) : []);
    }

    await teacherDoc.save();

    // Synchronize TeacherUser login account across the entire system!
    const TeacherUser = require('../models/TeacherUser');
    let teacherUser = await TeacherUser.findOne({ teacher: teacherDoc._id });
    if (!teacherUser && oldEmail) {
      teacherUser = await TeacherUser.findOne({ email: oldEmail });
    }
    if (!teacherUser && newEmail) {
      teacherUser = await TeacherUser.findOne({ email: newEmail });
    }

    if (teacherUser) {
      if (name !== undefined) teacherUser.name = teacherDoc.name;
      if (newEmail) teacherUser.email = newEmail;
      if (designation !== undefined) teacherUser.designation = teacherDoc.designation;
      if (department !== undefined) teacherUser.department = teacherDoc.department;
      teacherUser.teacher = teacherDoc._id;
      teacherUser.isVerified = true;
      teacherUser.isApproved = true;
      await teacherUser.save();
    } else if (newEmail) {
      // Auto-provision TeacherUser if it didn't exist before
      await TeacherUser.create({
        name: teacherDoc.name,
        email: newEmail,
        password: '12345678',
        department: teacherDoc.department,
        designation: teacherDoc.designation || 'Lecturer',
        teacher: teacherDoc._id,
        isVerified: true,
        isApproved: true,
        forcePasswordChange: true
      });
    }

    const populated = await Teacher.findById(teacherDoc._id).populate('department', 'name code');
    res.json({ message: 'Teacher updated successfully. Email updated across the entire system and login credentials synced.', teacher: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reset a teacher's password to 12345678 (Admin only)
exports.resetTeacherPassword = async (req, res) => {
  try {
    const teacherDoc = await Teacher.findById(req.params.id);
    if (!teacherDoc) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const cleanEmail = teacherDoc.email ? teacherDoc.email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      return res.status(400).json({ message: 'Please assign an email to this teacher first before resetting password.' });
    }

    const TeacherUser = require('../models/TeacherUser');
    let teacherUser = await TeacherUser.findOne({ teacher: teacherDoc._id });
    if (!teacherUser) {
      teacherUser = await TeacherUser.findOne({ email: cleanEmail });
    }

    if (teacherUser) {
      teacherUser.password = '12345678';
      teacherUser.forcePasswordChange = true;
      teacherUser.isVerified = true;
      teacherUser.isApproved = true;
      teacherUser.teacher = teacherDoc._id;
      await teacherUser.save();
    } else {
      teacherUser = await TeacherUser.create({
        name: teacherDoc.name,
        email: cleanEmail,
        password: '12345678',
        department: teacherDoc.department,
        designation: teacherDoc.designation || 'Lecturer',
        teacher: teacherDoc._id,
        isVerified: true,
        isApproved: true,
        forcePasswordChange: true
      });
    }

    res.json({ message: `Password for ${teacherDoc.name} (${cleanEmail}) has been reset to "12345678".` });
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
