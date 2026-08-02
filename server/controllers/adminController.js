const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const CourseAssignment = require('../models/CourseAssignment');
const Teacher = require('../models/Teacher');
const ReviewSession = require('../models/ReviewSession');
const { JWT_SECRET } = require('../middleware/auth');

// Admin login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Course Assignment CRUD ───

// Get all course assignments (optionally filter by department, series, semester)
exports.getAssignments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.series) filter.series = req.query.series;
    if (req.query.semester) filter.semester = req.query.semester;

    const assignments = await CourseAssignment.find(filter)
      .populate('department', 'name code')
      .populate('teacher', 'name designation email')
      .sort({ createdAt: -1 });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a course assignment
exports.createAssignment = async (req, res) => {
  try {
    const { courseCode, courseName, department, semester, series, teacher } = req.body;

    if (!courseCode || !courseName || !department || !series || !teacher) {
      return res.status(400).json({ message: 'Course Code, Course Name, Department, Series, and Teacher are required' });
    }

    const assignment = await CourseAssignment.create({
      courseCode: courseCode.trim(),
      courseName: courseName.trim(),
      department,
      semester: semester || '',
      series: series.trim(),
      teacher,
    });

    // Automatically add courseName to Teacher profile if not already listed
    const teacherDoc = await Teacher.findById(teacher);
    if (teacherDoc && !teacherDoc.courses.includes(courseName.trim())) {
      teacherDoc.courses.push(courseName.trim());
      await teacherDoc.save();
    }

    const populated = await CourseAssignment.findById(assignment._id)
      .populate('department', 'name code')
      .populate('teacher', 'name designation email');

    res.status(201).json({ message: 'Course assignment created successfully', assignment: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a course assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { courseCode, courseName, department, semester, series, teacher, isActive } = req.body;

    const updated = await CourseAssignment.findByIdAndUpdate(
      req.params.id,
      {
        ...(courseCode && { courseCode: courseCode.trim() }),
        ...(courseName && { courseName: courseName.trim() }),
        ...(department && { department }),
        ...(semester !== undefined && { semester }),
        ...(series && { series: series.trim() }),
        ...(teacher && { teacher }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    )
      .populate('department', 'name code')
      .populate('teacher', 'name designation email');

    if (!updated) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Ensure teacher profile has course listed
    if (courseName && teacher) {
      const teacherDoc = await Teacher.findById(teacher);
      if (teacherDoc && !teacherDoc.courses.includes(courseName.trim())) {
        teacherDoc.courses.push(courseName.trim());
        await teacherDoc.save();
      }
    }

    res.json({ message: 'Course assignment updated successfully', assignment: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a course assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const deleted = await CourseAssignment.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.json({ message: 'Course assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current review session status
exports.getReviewSession = async (req, res) => {
  try {
    const session = await ReviewSession.getCurrentSession();
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle or update review session
exports.toggleReviewSession = async (req, res) => {
  try {
    const session = await ReviewSession.getCurrentSession();
    const { isOpen, sessionName, startDate, endDate, message, closedMessage } = req.body;

    if (isOpen !== undefined) session.isOpen = Boolean(isOpen);
    if (sessionName !== undefined) session.sessionName = sessionName;
    if (startDate !== undefined) session.startDate = startDate;
    if (endDate !== undefined) session.endDate = endDate;
    if (message !== undefined) session.message = message;
    if (closedMessage !== undefined) session.closedMessage = closedMessage;

    await session.save();
    res.json({ message: `Review session is now ${session.isOpen ? 'OPEN' : 'CLOSED'}`, session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change Admin Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const admin = await Admin.findById(req.admin?.id || req.user?.id); // auth middleware sets req.admin.id
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

