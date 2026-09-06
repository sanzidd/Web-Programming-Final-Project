const express = require('express');
const jwt = require('jsonwebtoken');
const XlsxPopulate = require('xlsx-populate');
const path = require('path');
const TeacherUser = require('../models/TeacherUser');
const Teacher = require('../models/Teacher');
const Feedback = require('../models/Feedback');
const Department = require('../models/Department');
const CourseAssignment = require('../models/CourseAssignment');
const teacherAuth = require('../middleware/teacherAuth');
const { sendVerificationEmail } = require('../utils/sendEmail');
const { generateFeedbackExcel } = require('../services/excelReportGenerator');

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

// Helper: compute overall avg for a single feedback
function computeFeedbackOverall(f) {
  const scores = [];
  if (f.courseContentOrg) {
    scores.push((f.courseContentOrg.q1_objectives + f.courseContentOrg.q2_workload + f.courseContentOrg.q3_organized) / 3);
  }
  if (f.teachingLearning) {
    scores.push((f.teachingLearning.q1_structured + f.teachingLearning.q2_participation + f.teachingLearning.q3_materials + f.teachingLearning.q4_assessment) / 4);
  }
  if (f.academicFacilities) {
    scores.push((f.academicFacilities.q1_environment + f.academicFacilities.q2_classrooms + f.academicFacilities.q3_laboratory) / 3);
  }
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
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

    // Check duplicate email
    const existing = await TeacherUser.findOne({ email: email.toLowerCase() });
    if (existing && existing.isVerified) {
      return res.status(400).json({ message: 'This email is already registered' });
    }

    // Direct registration (Verification disabled)
    let user = existing;
    if (existing && !existing.isVerified) {
      existing.name = name;
      existing.password = password;
      existing.department = departmentId || undefined;
      existing.designation = designation || '';
      existing.isVerified = true;
      existing.verificationCode = undefined;
      existing.verificationExpires = undefined;
      await existing.save();
    } else {
      user = await TeacherUser.create({
        name,
        email: email.toLowerCase(),
        password,
        department: departmentId || undefined,
        designation: designation || '',
        isVerified: true,
      });
    }

    // Find or create matching Teacher profile document
    let teacher = await Teacher.findOne({ email: user.email });
    if (!teacher) {
      // Also try matching by name + department
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
        return res.status(400).json({ message: 'No department available. Please provide a departmentId.' });
      }

      teacher = await Teacher.create({
        name: user.name,
        email: user.email,
        department: deptId,
        designation: user.designation || 'Lecturer'
      });
    }

    user.teacher = teacher._id;
    await user.save();

    res.status(201).json({ 
      message: 'Registration successful! You can now log in.', 
      email: email.toLowerCase(),
      emailSent: false, // Verification is bypassed
      bypassedVerification: true
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

    const user = await TeacherUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email first' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
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
          avgTeachingLearning: 0,
          avgFacilities: 0,
          avgCOAttainment: 0,
          sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
        };
      }
      courseMap[key].feedbacks.push(fb);
      courseMap[key].totalFeedbacks++;
      courseMap[key].sentimentCounts[fb.sentiment || 'neutral']++;
    });

    // Compute averages per course
    const courses = Object.values(courseMap).map(c => {
      const n = c.totalFeedbacks || 1;
      
      c.avgCourseContent = +(c.feedbacks.reduce((s, f) => {
        if (!f.courseContentOrg) return s;
        return s + (f.courseContentOrg.q1_objectives + f.courseContentOrg.q2_workload + f.courseContentOrg.q3_organized) / 3;
      }, 0) / n).toFixed(2);

      c.avgTeachingLearning = +(c.feedbacks.reduce((s, f) => {
        if (!f.teachingLearning) return s;
        return s + (f.teachingLearning.q1_structured + f.teachingLearning.q2_participation + f.teachingLearning.q3_materials + f.teachingLearning.q4_assessment) / 4;
      }, 0) / n).toFixed(2);

      c.avgFacilities = +(c.feedbacks.reduce((s, f) => {
        if (!f.academicFacilities) return s;
        return s + (f.academicFacilities.q1_environment + f.academicFacilities.q2_classrooms + f.academicFacilities.q3_laboratory) / 3;
      }, 0) / n).toFixed(2);

      // CO Attainment
      let coTotal = 0, coCount = 0;
      c.feedbacks.forEach(f => {
        (f.coFeedback || []).forEach(co => {
          coTotal += co.q1_achievement;
          coCount++;
        });
      });
      c.avgCOAttainment = coCount > 0 ? +(coTotal / coCount).toFixed(2) : 0;

      c.avgOverall = +((c.avgCourseContent + c.avgTeachingLearning + c.avgFacilities + (c.avgCOAttainment || c.avgCourseContent)) / (c.avgCOAttainment > 0 ? 4 : 3)).toFixed(2);

      delete c.feedbacks; // Don't send all feedbacks in dashboard overview
      return c;
    });

    // Overall summary
    const totalFeedbacks = feedbacks.length;
    const overallAvg = totalFeedbacks > 0
      ? +(feedbacks.reduce((s, f) => s + computeFeedbackOverall(f), 0) / totalFeedbacks).toFixed(2)
      : 0;
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    feedbacks.forEach(f => sentimentCounts[f.sentiment || 'neutral']++);

    // Get assigned courses from admin assignments
    const assignedCourses = await CourseAssignment.find({ teacher: req.teacherId, isActive: true })
      .populate('department', 'name code')
      .sort({ semester: 1, courseCode: 1 });

    res.json({
      teacher,
      summary: {
        totalFeedbacks,
        totalCourses: Math.max(courses.length, assignedCourses.length),
        overallAvg,
        avgCourseContent: teacher?.avgCourseContent || 0,
        avgTeachingLearning: teacher?.avgTeachingLearning || 0,
        avgFacilities: teacher?.avgFacilities || 0,
        avgCOAttainment: teacher?.avgCOAttainment || 0,
        sentimentCounts,
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
    const n = feedbacks.length || 1;

    const avgCourseContent = +(feedbacks.reduce((s, f) => {
      if (!f.courseContentOrg) return s;
      return s + (f.courseContentOrg.q1_objectives + f.courseContentOrg.q2_workload + f.courseContentOrg.q3_organized) / 3;
    }, 0) / n).toFixed(2);

    const avgTeachingLearning = +(feedbacks.reduce((s, f) => {
      if (!f.teachingLearning) return s;
      return s + (f.teachingLearning.q1_structured + f.teachingLearning.q2_participation + f.teachingLearning.q3_materials + f.teachingLearning.q4_assessment) / 4;
    }, 0) / n).toFixed(2);

    const avgFacilities = +(feedbacks.reduce((s, f) => {
      if (!f.academicFacilities) return s;
      return s + (f.academicFacilities.q1_environment + f.academicFacilities.q2_classrooms + f.academicFacilities.q3_laboratory) / 3;
    }, 0) / n).toFixed(2);

    let coTotal = 0, coCount = 0;
    feedbacks.forEach(f => {
      (f.coFeedback || []).forEach(co => {
        coTotal += co.q1_achievement;
        coCount++;
      });
    });
    const avgCOAttainment = coCount > 0 ? +(coTotal / coCount).toFixed(2) : 0;

    const avgOverall = +((avgCourseContent + avgTeachingLearning + avgFacilities + (avgCOAttainment || avgCourseContent)) / (avgCOAttainment > 0 ? 4 : 3)).toFixed(2);

    const summary = {
      courseName,
      totalFeedbacks: feedbacks.length,
      avgOverall,
      avgCourseContent,
      avgTeachingLearning,
      avgFacilities,
      avgCOAttainment,
    };

    res.json({ summary, feedbacks });
  } catch (error) {
    console.error('Course feedback error:', error);
    res.status(500).json({ message: 'Failed to load course feedback' });
  }
});

// ══════════════════════════════════════════
//  GET /course-feedback/:courseName/export — Download full .xlsx report
// ══════════════════════════════════════════
router.get('/course-feedback/:courseName/export', teacherAuth, async (req, res) => {
  try {
    if (!req.teacherId) {
      return res.status(400).json({ message: 'No teacher profile linked' });
    }

    const courseName = decodeURIComponent(req.params.courseName);
    const feedbacks = await Feedback.find({ teacher: req.teacherId, courseName })
      .populate('department', 'name code')
      .sort({ createdAt: 1 });

    // Get teacher info
    const teacher = await Teacher.findById(req.teacherId).populate('department', 'name code');

    // Get course assignment to find COs
    const assignmentDoc = await CourseAssignment.findOne({ 
      teacher: req.teacherId, 
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
      department: assignmentDoc?.department || teacher?.department || feedbacks[0]?.department || { name: 'Unknown', code: '' }
    };

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

module.exports = router;
