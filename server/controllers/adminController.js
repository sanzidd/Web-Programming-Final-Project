const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const CourseAssignment = require('../models/CourseAssignment');
const Teacher = require('../models/Teacher');
const ReviewSession = require('../models/ReviewSession');
const Feedback = require('../models/Feedback');
const FeedbackLog = require('../models/FeedbackLog');
const Student = require('../models/Student');
const XlsxPopulate = require('xlsx-populate');
const path = require('path');
const { JWT_SECRET } = require('../middleware/auth');
const { generateFeedbackExcel } = require('../services/excelReportGenerator');

function scoreToLabel(score) {
  const map = { 5: 'Strongly Agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly Disagree' };
  return map[score] || '';
}

function achievementToLabel(score) {
  const map = { 1: 'Not at all', 2: 'Slightly', 3: 'Moderately', 4: 'Significantly', 5: 'Completely' };
  return map[score] || '';
}

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
    const { courseCode, courseName, department, semester, series, teacher, courseOutcomes } = req.body;

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
      courseOutcomes: courseOutcomes || [],
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
    const { courseCode, courseName, department, semester, series, teacher, isActive, courseOutcomes } = req.body;

    const updateFields = {};
    if (courseCode) updateFields.courseCode = courseCode.trim();
    if (courseName) updateFields.courseName = courseName.trim();
    if (department) updateFields.department = department;
    if (semester !== undefined) updateFields.semester = semester;
    if (series) updateFields.series = series.trim();
    if (teacher) updateFields.teacher = teacher;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (courseOutcomes !== undefined) updateFields.courseOutcomes = courseOutcomes;

    const updated = await CourseAssignment.findByIdAndUpdate(
      req.params.id,
      updateFields,
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

// Toggle review session per course assignment
exports.toggleAssignmentSession = async (req, res) => {
  try {
    const { isReviewSessionOpen } = req.body;
    const assignment = await CourseAssignment.findByIdAndUpdate(
      req.params.id,
      { isReviewSessionOpen },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get feedback status for a specific course assignment
exports.getAssignmentStatus = async (req, res) => {
  try {
    const assignment = await CourseAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const filter = {};
    if (assignment.series !== 'all' && assignment.series !== '*') {
      // Find students whose roll starts with the series (e.g., "21")
      filter.roll = new RegExp(`^${assignment.series}`);
    }

    const students = await Student.find(filter).select('name roll');
    const logs = await FeedbackLog.find({ assignment: assignment._id }).select('student');
    const submittedStudentIds = new Set(logs.map(log => log.student.toString()));

    const statusList = students.map(s => ({
      name: s.name,
      roll: s.roll,
      hasSubmitted: submittedStudentIds.has(s._id.toString())
    }));

    // Sort by roll number
    statusList.sort((a, b) => a.roll.localeCompare(b.roll));

    res.json(statusList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  Export assignment feedback to a COMPLETE Excel file
//  with: Input data, computed graphs/summaries, Final Report
// ══════════════════════════════════════════════════════════════
exports.exportAssignmentExcel = async (req, res) => {
  try {
    const assignment = await CourseAssignment.findById(req.params.id).populate('teacher department');
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const feedbacks = await Feedback.find({ 
      teacher: assignment.teacher._id, 
      courseName: assignment.courseName 
    }).populate('department', 'name code').sort({ createdAt: 1 });

    const buffer = await generateFeedbackExcel({ assignment, feedbacks });
    const filename = `Feedback_Report_${assignment.courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Failed to export feedback' });
  }
};

