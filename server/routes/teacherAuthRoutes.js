const express = require('express');
const jwt = require('jsonwebtoken');
const XlsxPopulate = require('xlsx-populate');
const path = require('path');
const TeacherUser = require('../models/TeacherUser');
const Teacher = require('../models/Teacher');
const Feedback = require('../models/Feedback');
const Department = require('../models/Department');
const CourseAssignment = require('../models/CourseAssignment');
const CourseCatalog = require('../models/CourseCatalog');
const teacherAuth = require('../middleware/teacherAuth');
const { sendVerificationEmail } = require('../utils/sendEmail');
const { generateFeedbackExcel } = require('../services/excelReportGenerator');
const { generateFeedbackWord } = require('../services/wordReportGenerator');
const { aggregateScores, feedbackAverage } = require('../utils/feedbackScores');

function enrichAssignment(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return {
    ...obj,
    feedbackDeadline: obj.feedbackDeadline || null,
    isDeadlinePassed: CourseAssignment.isDeadlinePassed(obj),
    effectiveSessionOpen: CourseAssignment.isEffectiveSessionOpen(obj),
  };
}

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ruet-feedback-secret-key-2026';

// ─── Helper: generate 6-digit code ───
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Helper: map numeric score (1-5) to Likert label ───
function scoreToLabel(score) {
  const map = { 5: 'Strongly Agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly Disagree' };
  return map[score] || '';
}

function achievementToLabel(score) {
  const map = { 1: 'Not at all', 2: 'Slightly', 3: 'Moderately', 4: 'Significantly', 5: 'Completely' };
  return map[score] || '';
}

// Helper: compute overall avg for a single feedback (current + legacy fields)
function computeFeedbackOverall(f) {
  return feedbackAverage(f) || 0;
}

// ══════════════════════════════════════════
//  POST /register — Step 1: Register + send verification code
// ══════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, departmentId, designation } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existing = await TeacherUser.findOne({ email: cleanEmail });
    if (existing && existing.isApproved !== false && existing.isVerified) {
      return res.status(400).json({ message: 'This email is already registered. Please log in.' });
    }

    if (existing && existing.isApproved === false) {
      // Re-updating details while pending approval
      existing.name = name.trim();
      existing.password = password;
      existing.department = departmentId || existing.department;
      existing.designation = designation || existing.designation;
      await existing.save();
      return res.status(200).json({
        message: 'Your registration was already submitted and is currently pending admin approval. You will be able to log in once the admin verifies and approves your account.',
        isPendingApproval: true
      });
    }

    // Check if the teacher is already listed in the admin's faculty directory!
    let teacher = await Teacher.findOne({ 
      email: { $regex: new RegExp(`^${cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') } 
    }).populate('department');

    if (!teacher && departmentId) {
      teacher = await Teacher.findOne({
        name: { $regex: new RegExp(`^${name.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
        department: departmentId
      });
    }

    if (teacher) {
      // 1. RECOGNIZED FACULTY: Already listed in the admin's faculty directory!
      let user = existing;
      if (user) {
        user.name = name.trim();
        user.password = password;
        user.department = teacher.department?._id || departmentId;
        user.designation = teacher.designation || designation || '';
        user.teacher = teacher._id;
        user.isVerified = true;
        user.isApproved = true;
        user.forcePasswordChange = false;
        await user.save();
      } else {
        user = await TeacherUser.create({
          name: name.trim(),
          email: cleanEmail,
          password,
          department: teacher.department?._id || departmentId,
          designation: teacher.designation || designation || '',
          teacher: teacher._id,
          isVerified: true,
          isApproved: true,
          forcePasswordChange: false
        });
      }

      if (!teacher.email || teacher.email.toLowerCase() !== cleanEmail) {
        teacher.email = cleanEmail;
        await teacher.save();
      }

      return res.status(201).json({ 
        message: 'Registration successful! Your faculty profile was recognized. You can now log in.', 
        email: cleanEmail,
        isPendingApproval: false
      });
    }

    // 2. UNKNOWN EMAIL: Not listed in the admin's faculty list!
    // Requires Admin's manual approval and verification before adding to main server.
    const user = await TeacherUser.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      department: departmentId || undefined,
      designation: designation || 'Lecturer',
      isVerified: false,
      isApproved: false,
      forcePasswordChange: false
    });

    res.status(201).json({ 
      message: 'Registration submitted! Since your email is not pre-listed in the faculty directory, admin approval is required before you can log in.', 
      email: cleanEmail,
      isPendingApproval: true
    });
  } catch (error) {
    console.error('Teacher register error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// ══════════════════════════════════════════
//  POST /verify — Step 2: Verify code + activate account
// ══════════════════════════════════════════
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const user = await TeacherUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No registration found for this email' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Account is already verified. Please login.' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (user.verificationExpires < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired. Please register again.' });
    }

    // Activate account
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;

    // Find or create matching Teacher profile document
    let teacher = await Teacher.findOne({ email: user.email });
    if (!teacher) {
      const query = { name: user.name };
      if (user.department) query.department = user.department;
      teacher = await Teacher.findOne(query);
    }

    if (!teacher) {
      let deptId = user.department;
      if (!deptId) {
        const defaultDept = await Department.findOne({});
        deptId = defaultDept?._id;
      }
      
      if (!deptId) {
        return res.status(400).json({ 
          message: 'Please select a department during registration to complete verification.' 
        });
      }

      teacher = await Teacher.create({
        name: user.name,
        email: user.email,
        designation: user.designation || 'Lecturer',
        department: deptId,
        courses: [],
      });
    } else {
      if (!teacher.email) {
        teacher.email = user.email;
        await teacher.save();
      }
    }

    user.teacher = teacher._id;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: 'teacher', teacherId: teacher._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email verified successfully!',
      token,
      teacherUser: {
        id: user._id,
        name: user.name,
        email: user.email,
        teacherId: teacher._id,
        designation: user.designation,
      },
    });
  } catch (error) {
    console.error('Verify error:', error.message, error.stack);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
});

// ══════════════════════════════════════════
//  POST /login — Login with email + password
// ══════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    let user = await TeacherUser.findOne({ 
      email: { $regex: new RegExp(`^${cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') }
    });

    // If no TeacherUser exists yet, check if teacher is listed in Teacher directory!
    // All listed teachers can log in initially with default password '12345678'
    if (!user) {
      const teacherDoc = await Teacher.findOne({
        email: { $regex: new RegExp(`^${cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') }
      }).populate('department');

      if (teacherDoc && password === '12345678') {
        user = await TeacherUser.create({
          name: teacherDoc.name,
          email: teacherDoc.email || cleanEmail,
          password: '12345678',
          department: teacherDoc.department?._id,
          designation: teacherDoc.designation || 'Lecturer',
          teacher: teacherDoc._id,
          isVerified: true,
          forcePasswordChange: true
        });
        console.log(`[Teacher Auth] Auto-provisioned TeacherUser account for ${teacherDoc.name} (${cleanEmail})`);
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.isApproved === false) {
      return res.status(403).json({ 
        message: 'Your registration is pending administrator approval. Please wait for the admin to verify and approve your account.' 
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Your account is pending administrator verification. Please wait for approval.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Auto-link teacher profile if missing
    if (!user.teacher) {
      const teacherProfile = await Teacher.findOne({ email: user.email.toLowerCase() })
        || await Teacher.findOne({ name: user.name });
      if (teacherProfile) {
        user.teacher = teacherProfile._id;
        await user.save();
      }
    }

    const token = jwt.sign(
      { id: user._id, role: 'teacher', teacherId: user.teacher },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      teacherUser: {
        id: user._id,
        name: user.name,
        email: user.email,
        teacherId: user.teacher,
        designation: user.designation,
        forcePasswordChange: Boolean(user.forcePasswordChange),
      },
    });
  } catch (error) {
    console.error('Teacher login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// ══════════════════════════════════════════
//  GET /me — Current teacher profile
// ══════════════════════════════════════════
router.get('/me', teacherAuth, async (req, res) => {
  try {
    const user = await TeacherUser.findById(req.teacherUserId)
      .select('-password -verificationCode -verificationExpires')
      .populate('department', 'name code')
      .populate('teacher');
    if (!user) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// ══════════════════════════════════════════
//  POST /change-password — Mandatory or optional password change
// ══════════════════════════════════════════
router.post('/change-password', teacherAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const user = await TeacherUser.findById(req.teacherUserId);
    if (!user) {
      return res.status(404).json({ message: 'Teacher user not found' });
    }

    if (currentPassword && !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    user.password = newPassword;
    user.forcePasswordChange = false;
    await user.save();

    res.json({ 
      message: 'Password changed successfully!',
      forcePasswordChange: false,
      teacherUser: {
        id: user._id,
        name: user.name,
        email: user.email,
        teacherId: user.teacher,
        designation: user.designation,
        forcePasswordChange: false
      }
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password. Please try again.' });
  }
});

// ══════════════════════════════════════════
//  GET /dashboard — Teacher dashboard data
// ══════════════════════════════════════════
router.get('/dashboard', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) {
      return res.status(400).json({ message: 'No teacher profile linked. Please contact admin.' });
    }

    // Get all feedbacks for this teacher
    const feedbacks = await Feedback.find({ teacher: req.teacherId })
      .populate('department', 'name code')
      .sort({ createdAt: -1 });

    // Get teacher profile
    const teacher = await Teacher.findById(req.teacherId).populate('department', 'name code');

    // Group by courseName
    const courseMap = {};
    feedbacks.forEach(fb => {
      const key = fb.courseName || 'Unknown Course';
      if (!courseMap[key]) {
        courseMap[key] = {
          courseName: key,
          feedbacks: [],
          totalFeedbacks: 0,
          avgOverall: 0,
          avgCourseContent: 0,
          avgFacilities: 0,
          avgCourseTeacher: 0,
          avgCOAttainment: 0,
        };
      }
      courseMap[key].feedbacks.push(fb);
      courseMap[key].totalFeedbacks++;
    });

    // Compute averages per course
    const courses = Object.values(courseMap).map(c => {
      const agg = aggregateScores(c.feedbacks);
      c.avgCourseContent = agg.avgCourseContent;
      c.avgCOAttainment = agg.avgCOAttainment;
      c.avgFacilities = agg.avgFacilities;
      c.avgCourseTeacher = agg.avgCourseTeacher;
      c.avgOverall = agg.avgRating;

      delete c.feedbacks; // Don't send all feedbacks in dashboard overview
      return c;
    });

    // Overall summary across all feedbacks for this teacher
    const totalFeedbacks = feedbacks.length;
    const summaryAgg = aggregateScores(feedbacks);
    const summaryCourseContent = summaryAgg.avgCourseContent;
    const summaryFacilities = summaryAgg.avgFacilities;
    const summaryCOAttainment = summaryAgg.avgCOAttainment;
    const summaryCourseTeacher = summaryAgg.avgCourseTeacher;
    const overallAvg = summaryAgg.avgRating;

    // Keep Teacher profile model synchronized with live feedback stats
    if (teacher && totalFeedbacks > 0) {
      await Teacher.findByIdAndUpdate(req.teacherId, {
        avgRating: overallAvg,
        avgCourseContent: summaryCourseContent,
        avgFacilities: summaryFacilities,
        avgCOAttainment: summaryCOAttainment,
        avgCourseTeacher: summaryCourseTeacher,
        totalFeedbacks
      });
    }

    // Get assigned courses from admin assignments
    const assignedCoursesRaw = await CourseAssignment.find({ teacher: req.teacherId, isActive: true })
      .populate('department', 'name code')
      .sort({ semester: 1, courseCode: 1 });
    const assignedCourses = assignedCoursesRaw.map(enrichAssignment);

    res.json({
      teacher,
      summary: {
        totalFeedbacks,
        totalCourses: Math.max(courses.length, assignedCourses.length),
        overallAvg,
        avgCourseContent: summaryCourseContent,
        avgFacilities: summaryFacilities,
        avgCOAttainment: summaryCOAttainment,
        avgCourseTeacher: summaryCourseTeacher,
      },
      courses,
      assignedCourses,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
});

// ══════════════════════════════════════════
//  GET /course-feedback/:courseName — All feedbacks for a course
// ══════════════════════════════════════════
router.get('/course-feedback/:courseName', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) {
      return res.status(400).json({ message: 'No teacher profile linked' });
    }

    const courseName = decodeURIComponent(req.params.courseName);
    const feedbacks = await Feedback.find({ teacher: req.teacherId, courseName })
      .populate('department', 'name code')
      .sort({ createdAt: 1 });

    // Compute course averages
    const agg = aggregateScores(feedbacks);
    const summary = {
      courseName,
      totalFeedbacks: feedbacks.length,
      avgOverall: agg.avgRating,
      avgCourseContent: agg.avgCourseContent,
      avgFacilities: agg.avgFacilities,
      avgCOAttainment: agg.avgCOAttainment,
      avgCourseTeacher: agg.avgCourseTeacher,
    };

    res.json({ summary, feedbacks });
  } catch (error) {
    console.error('Course feedback error:', error);
    res.status(500).json({ message: 'Failed to load course feedback' });
  }
});

async function buildTeacherCourseReportData(teacherId, courseName) {
  const feedbacks = await Feedback.find({ teacher: teacherId, courseName })
    .populate('department', 'name code')
    .sort({ createdAt: 1 });

  const teacher = await Teacher.findById(teacherId).populate('department', 'name code');

  const assignmentDoc = await CourseAssignment.findOne({
    teacher: teacherId,
    courseName
  }).populate('department', 'name code');

  const assignment = {
    courseName,
    courseCode: assignmentDoc?.courseCode || '',
    semester: assignmentDoc?.semester || '',
    series: assignmentDoc?.series || '',
    courseOutcomes: assignmentDoc?.courseOutcomes || [],
    teacher: {
      name: teacher?.name || 'Unknown',
      designation: teacher?.designation || ''
    },
    department: assignmentDoc?.department || teacher?.department || feedbacks[0]?.department || { name: 'Electronics and Telecommunication Engineering', code: 'ETE' }
  };

  return { assignment, feedbacks };
}

// ══════════════════════════════════════════
//  GET /course-feedback/:courseName/export — Download full .xlsx report
// ══════════════════════════════════════════
router.get('/course-feedback/:courseName/export', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) {
      return res.status(400).json({ message: 'No teacher profile linked' });
    }

    const courseName = decodeURIComponent(req.params.courseName);
    const { assignment, feedbacks } = await buildTeacherCourseReportData(req.teacherId, courseName);

    const buffer = await generateFeedbackExcel({ assignment, feedbacks });
    const filename = `Student_Feedback_${courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Failed to export feedback' });
  }
});

// ══════════════════════════════════════════
//  GET /course-feedback/:courseName/export-doc — Download Final Feedback .docx report
// ══════════════════════════════════════════
router.get('/course-feedback/:courseName/export-doc', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) {
      return res.status(400).json({ message: 'No teacher profile linked' });
    }

    const courseName = decodeURIComponent(req.params.courseName);
    const { assignment, feedbacks } = await buildTeacherCourseReportData(req.teacherId, courseName);

    const buffer = await generateFeedbackWord({ assignment, feedbacks });
    const filename = `Final_Feedback_${courseName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Word export error:', error);
    res.status(500).json({ message: 'Failed to export Word feedback report' });
  }
});

// ══════════════════════════════════════════
//  GET /assignments/:id/export & /assignments/:id/export-doc — Download reports by assignment ID
// ══════════════════════════════════════════
router.get('/assignments/:id/export', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) return res.status(400).json({ message: 'No teacher profile linked' });
    const assignment = await CourseAssignment.findById(req.params.id).populate('teacher department');
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    const assignedTeacherId = assignment.teacher?._id || assignment.teacher;
    if (!assignedTeacherId || assignedTeacherId.toString() !== req.teacherId.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    const feedbacks = await Feedback.find({
      teacher: req.teacherId,
      courseName: assignment.courseName
    }).populate('department', 'name code').sort({ createdAt: 1 });

    const buffer = await generateFeedbackExcel({ assignment, feedbacks });
    const filename = `Student_Feedback_${assignment.courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Teacher assignment Excel export error:', error);
    res.status(500).json({ message: 'Failed to export Excel report' });
  }
});

router.get('/assignments/:id/export-doc', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) return res.status(400).json({ message: 'No teacher profile linked' });
    const assignment = await CourseAssignment.findById(req.params.id).populate('teacher department');
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    const assignedTeacherId = assignment.teacher?._id || assignment.teacher;
    if (!assignedTeacherId || assignedTeacherId.toString() !== req.teacherId.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    const feedbacks = await Feedback.find({
      teacher: req.teacherId,
      courseName: assignment.courseName
    }).populate('department', 'name code').sort({ createdAt: 1 });

    const buffer = await generateFeedbackWord({ assignment, feedbacks });
    const filename = `Final_Feedback_${assignment.courseName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Teacher assignment Word export error:', error);
    res.status(500).json({ message: 'Failed to export Word report' });
  }
});

// ══════════════════════════════════════════
//  PUT /assignments/:id/course-outcomes — Teacher can edit CO title and details for assigned courses
// ══════════════════════════════════════════
router.put('/assignments/:id/course-outcomes', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) {
      return res.status(400).json({ message: 'No teacher profile linked' });
    }

    const assignment = await CourseAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.teacher.toString() !== req.teacherId.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    const { courseOutcomes } = req.body;
    if (!Array.isArray(courseOutcomes)) {
      return res.status(400).json({ message: 'courseOutcomes must be an array' });
    }

    const validCOs = courseOutcomes
      .filter(co => co && ((co.title && String(co.title).trim()) || (co.description && String(co.description).trim())))
      .map((co, idx) => {
        const coNumber = Number(co.coNumber) || idx + 1;
        return {
          coNumber,
          title: (co.title && String(co.title).trim()) ? String(co.title).trim() : `CO${coNumber}`,
          description: (co.description || '').trim()
        };
      });

    assignment.courseOutcomes = validCOs;
    await assignment.save();

    if (assignment.courseCode && validCOs.length > 0) {
      const escaped = assignment.courseCode.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      await CourseCatalog.findOneAndUpdate(
        { courseCode: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { $set: { courseOutcomes: validCOs } }
      );
    }

    const populated = await CourseAssignment.findById(assignment._id)
      .populate('department', 'name code')
      .populate('teacher', 'name designation email');

    res.json({
      message: `Course Outcomes updated successfully (${validCOs.length} COs)`,
      assignment: enrichAssignment(populated)
    });
  } catch (error) {
    console.error('Teacher CO update error:', error);
    res.status(500).json({ message: 'Failed to update Course Outcomes' });
  }
});

// ══════════════════════════════════════════
//  PUT /assignments/:id/deadline — Assigned Teacher can set or extend feedback deadline
// ══════════════════════════════════════════
router.put('/assignments/:id/deadline', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) {
      return res.status(400).json({ message: 'No teacher profile linked' });
    }

    const assignment = await CourseAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.teacher.toString() !== req.teacherId.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    const { feedbackDeadline } = req.body;
    let parsedDeadline = null;
    if (feedbackDeadline !== null && feedbackDeadline !== '' && feedbackDeadline !== undefined) {
      parsedDeadline = new Date(feedbackDeadline);
      if (Number.isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ message: 'Invalid deadline date format' });
      }
    }

    assignment.feedbackDeadline = parsedDeadline;
    if (parsedDeadline && parsedDeadline.getTime() > Date.now()) {
      assignment.isReviewSessionOpen = true;
    }
    await assignment.save();

    const populated = await CourseAssignment.findById(assignment._id)
      .populate('department', 'name code')
      .populate('teacher', 'name designation email');

    res.json({
      message: parsedDeadline ? 'Feedback deadline updated successfully' : 'Feedback deadline cleared',
      assignment: enrichAssignment(populated)
    });
  } catch (error) {
    console.error('Teacher deadline update error:', error);
    res.status(500).json({ message: 'Failed to update feedback deadline' });
  }
});

module.exports = router;
