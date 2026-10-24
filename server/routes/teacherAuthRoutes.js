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

function safeNum(val) {
  const n = Number(val);
  return (!isNaN(n) && isFinite(n) && n > 0) ? n : null;
}

// Helper: compute overall avg for a single feedback
function computeFeedbackOverall(f) {
  const scores = [];

  // 1. Course Content & Organisation (support modern & legacy fields)
  const c = f.courseContentOrg || f.courseContent;
  if (c) {
    const vals = [safeNum(c.q1_objectives || c.q1), safeNum(c.q2_workload || c.q2), safeNum(c.q3_organized || c.q3)].filter(v => v !== null);
    if (vals.length > 0) scores.push(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  // 2. Teaching-Learning & Assessment (support modern & legacy fields)
  const tl = f.teachingLearning || f.learningEnvironment;
  if (tl) {
    const vals = [safeNum(tl.q1_structured || tl.q8), safeNum(tl.q2_participation || tl.q9), safeNum(tl.q3_materials || f.learningResources?.q13), safeNum(tl.q4_assessment || f.courseTeacher?.q18)].filter(v => v !== null);
    if (vals.length > 0) scores.push(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  // 3. Academic & Lab Facilities (support modern & legacy fields)
  const af = f.academicFacilities || f.learningResources;
  if (af) {
    const vals = [safeNum(af.q1_environment || f.learningEnvironment?.q10), safeNum(af.q2_classrooms || f.learningEnvironment?.q11), safeNum(af.q3_laboratory || af.q15)].filter(v => v !== null);
    if (vals.length > 0) scores.push(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  // 4. Course Outcomes (CO) Attainment
  if (Array.isArray(f.coFeedback) && f.coFeedback.length > 0) {
    const coVals = f.coFeedback.map(co => safeNum(co.q1_achievement)).filter(v => v !== null);
    if (coVals.length > 0) scores.push(coVals.reduce((a, b) => a + b, 0) / coVals.length);
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
          avgTeachingLearning: 0,
          avgFacilities: 0,
          avgOverall: 0,
          avgCourseContent: 0,
          avgTeachingLearning: 0,
          avgFacilities: 0,
          avgCOAttainment: 0,
        };
      }
      courseMap[key].feedbacks.push(fb);
      courseMap[key].totalFeedbacks++;
    });

    // Compute averages per course
    const courses = Object.values(courseMap).map(c => {
      let totalContent = 0, contentCount = 0;
      let totalTL = 0, tlCount = 0;
      let totalFac = 0, facCount = 0;
      let coTotal = 0, coCount = 0;

      c.feedbacks.forEach(f => {
        const cont = f.courseContentOrg || f.courseContent;
        if (cont) {
          const vals = [safeNum(cont.q1_objectives || cont.q1), safeNum(cont.q2_workload || cont.q2), safeNum(cont.q3_organized || cont.q3)].filter(v => v !== null);
          if (vals.length > 0) {
            totalContent += vals.reduce((a, b) => a + b, 0) / vals.length;
            contentCount++;
          }
        }

        const tl = f.teachingLearning || f.learningEnvironment;
        if (tl) {
          const vals = [safeNum(tl.q1_structured || tl.q8), safeNum(tl.q2_participation || tl.q9), safeNum(tl.q3_materials || f.learningResources?.q13), safeNum(tl.q4_assessment || f.courseTeacher?.q18)].filter(v => v !== null);
          if (vals.length > 0) {
            totalTL += vals.reduce((a, b) => a + b, 0) / vals.length;
            tlCount++;
          }
        }

        const af = f.academicFacilities || f.learningResources;
        if (af) {
          const vals = [safeNum(af.q1_environment || f.learningEnvironment?.q10), safeNum(af.q2_classrooms || f.learningEnvironment?.q11), safeNum(af.q3_laboratory || af.q15)].filter(v => v !== null);
          if (vals.length > 0) {
            totalFac += vals.reduce((a, b) => a + b, 0) / vals.length;
            facCount++;
          }
        }

        (f.coFeedback || []).forEach(co => {
          const q1 = safeNum(co.q1_achievement);
          if (q1 !== null) {
            coTotal += q1;
            coCount++;
          }
        });
      });

      c.avgCourseContent = contentCount > 0 ? +(totalContent / contentCount).toFixed(2) : 0;
      c.avgTeachingLearning = tlCount > 0 ? +(totalTL / tlCount).toFixed(2) : 0;
      c.avgFacilities = facCount > 0 ? +(totalFac / facCount).toFixed(2) : 0;
      c.avgCOAttainment = coCount > 0 ? +(coTotal / coCount).toFixed(2) : 0;

      const validCourseSections = [c.avgCourseContent, c.avgTeachingLearning, c.avgFacilities].filter(v => v > 0);
      if (c.avgCOAttainment > 0) validCourseSections.push(c.avgCOAttainment);

      c.avgOverall = validCourseSections.length > 0
        ? +(validCourseSections.reduce((a, b) => a + b, 0) / validCourseSections.length).toFixed(2)
        : 0;

      delete c.feedbacks; // Don't send all feedbacks in dashboard overview
      return c;
    });

    // Overall summary across all feedbacks for this teacher
    const totalFeedbacks = feedbacks.length;
    let totalContent = 0, contentCount = 0;
    let totalTL = 0, tlCount = 0;
    let totalFac = 0, facCount = 0;
    let coTotal = 0, coCount = 0;

    feedbacks.forEach(f => {
      const cont = f.courseContentOrg || f.courseContent;
      if (cont) {
        const vals = [safeNum(cont.q1_objectives || cont.q1), safeNum(cont.q2_workload || cont.q2), safeNum(cont.q3_organized || cont.q3)].filter(v => v !== null);
        if (vals.length > 0) {
          totalContent += vals.reduce((a, b) => a + b, 0) / vals.length;
          contentCount++;
        }
      }

      const tl = f.teachingLearning || f.learningEnvironment;
      if (tl) {
        const vals = [safeNum(tl.q1_structured || tl.q8), safeNum(tl.q2_participation || tl.q9), safeNum(tl.q3_materials || f.learningResources?.q13), safeNum(tl.q4_assessment || f.courseTeacher?.q18)].filter(v => v !== null);
        if (vals.length > 0) {
          totalTL += vals.reduce((a, b) => a + b, 0) / vals.length;
          tlCount++;
        }
      }

      const af = f.academicFacilities || f.learningResources;
      if (af) {
        const vals = [safeNum(af.q1_environment || f.learningEnvironment?.q10), safeNum(af.q2_classrooms || f.learningEnvironment?.q11), safeNum(af.q3_laboratory || af.q15)].filter(v => v !== null);
        if (vals.length > 0) {
          totalFac += vals.reduce((a, b) => a + b, 0) / vals.length;
          facCount++;
        }
      }

      (f.coFeedback || []).forEach(co => {
        const q1 = safeNum(co.q1_achievement);
        if (q1 !== null) {
          coTotal += q1;
          coCount++;
        }
      });
    });

    const summaryCourseContent = contentCount > 0 ? +(totalContent / contentCount).toFixed(2) : 0;
    const summaryTeachingLearning = tlCount > 0 ? +(totalTL / tlCount).toFixed(2) : 0;
    const summaryFacilities = facCount > 0 ? +(totalFac / facCount).toFixed(2) : 0;
    const summaryCOAttainment = coCount > 0 ? +(coTotal / coCount).toFixed(2) : 0;

    const validSummarySections = [summaryCourseContent, summaryTeachingLearning, summaryFacilities].filter(v => v > 0);
    if (summaryCOAttainment > 0) validSummarySections.push(summaryCOAttainment);

    const overallAvg = validSummarySections.length > 0
      ? +(validSummarySections.reduce((a, b) => a + b, 0) / validSummarySections.length).toFixed(2)
      : 0;

    // Keep Teacher profile model synchronized with live feedback stats
    if (teacher && totalFeedbacks > 0) {
      await Teacher.findByIdAndUpdate(req.teacherId, {
        avgRating: overallAvg,
        avgCourseContent: summaryCourseContent,
        avgTeachingLearning: summaryTeachingLearning,
        avgFacilities: summaryFacilities,
        avgCOAttainment: summaryCOAttainment,
        totalFeedbacks
      });
    }

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
        avgCourseContent: summaryCourseContent,
        avgTeachingLearning: summaryTeachingLearning,
        avgFacilities: summaryFacilities,
        avgCOAttainment: summaryCOAttainment,
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
    let totalContent = 0, contentCount = 0;
    let totalTL = 0, tlCount = 0;
    let totalFac = 0, facCount = 0;
    let coTotal = 0, coCount = 0;

    feedbacks.forEach(f => {
      const cont = f.courseContentOrg || f.courseContent;
      if (cont) {
        const vals = [safeNum(cont.q1_objectives || cont.q1), safeNum(cont.q2_workload || cont.q2), safeNum(cont.q3_organized || cont.q3)].filter(v => v !== null);
        if (vals.length > 0) {
          totalContent += vals.reduce((a, b) => a + b, 0) / vals.length;
          contentCount++;
        }
      }

      const tl = f.teachingLearning || f.learningEnvironment;
      if (tl) {
        const vals = [safeNum(tl.q1_structured || tl.q8), safeNum(tl.q2_participation || tl.q9), safeNum(tl.q3_materials || f.learningResources?.q13), safeNum(tl.q4_assessment || f.courseTeacher?.q18)].filter(v => v !== null);
        if (vals.length > 0) {
          totalTL += vals.reduce((a, b) => a + b, 0) / vals.length;
          tlCount++;
        }
      }

      const af = f.academicFacilities || f.learningResources;
      if (af) {
        const vals = [safeNum(af.q1_environment || f.learningEnvironment?.q10), safeNum(af.q2_classrooms || f.learningEnvironment?.q11), safeNum(af.q3_laboratory || af.q15)].filter(v => v !== null);
        if (vals.length > 0) {
          totalFac += vals.reduce((a, b) => a + b, 0) / vals.length;
          facCount++;
        }
      }

      (f.coFeedback || []).forEach(co => {
        const q1 = safeNum(co.q1_achievement);
        if (q1 !== null) {
          coTotal += q1;
          coCount++;
        }
      });
    });

    const avgCourseContent = contentCount > 0 ? +(totalContent / contentCount).toFixed(2) : 0;
    const avgTeachingLearning = tlCount > 0 ? +(totalTL / tlCount).toFixed(2) : 0;
    const avgFacilities = facCount > 0 ? +(totalFac / facCount).toFixed(2) : 0;
    const avgCOAttainment = coCount > 0 ? +(coTotal / coCount).toFixed(2) : 0;

    const validSections = [avgCourseContent, avgTeachingLearning, avgFacilities].filter(v => v > 0);
    if (avgCOAttainment > 0) validSections.push(avgCOAttainment);

    const avgOverall = validSections.length > 0
      ? +(validSections.reduce((a, b) => a + b, 0) / validSections.length).toFixed(2)
      : 0;

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

// ══════════════════════════════════════════
//  PUT /assignments/:id/course-outcomes — Teacher can add/edit COs for their assigned courses
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

    // Verify the teacher is assigned to this course
    if (assignment.teacher.toString() !== req.teacherId.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    const { courseOutcomes } = req.body;
    if (!Array.isArray(courseOutcomes)) {
      return res.status(400).json({ message: 'courseOutcomes must be an array' });
    }

    // Validate each CO has at least a title
    const validCOs = courseOutcomes
      .filter(co => co.title && co.title.trim())
      .map((co, idx) => ({
        coNumber: co.coNumber || idx + 1,
        title: co.title.trim(),
        description: (co.description || '').trim()
      }));

    assignment.courseOutcomes = validCOs;
    await assignment.save();

    const populated = await CourseAssignment.findById(assignment._id)
      .populate('department', 'name code')
      .populate('teacher', 'name designation email');

    res.json({ 
      message: `Course Outcomes updated successfully (${validCOs.length} COs)`, 
      assignment: populated 
    });
  } catch (error) {
    console.error('Teacher CO update error:', error);
    res.status(500).json({ message: 'Failed to update Course Outcomes' });
  }
});

module.exports = router;
