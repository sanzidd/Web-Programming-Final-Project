const express = require('express');
const jwt = require('jsonwebtoken');
const XlsxPopulate = require('xlsx-populate');
const path = require('path');
const TeacherUser = require('../models/TeacherUser');
const Teacher = require('../models/Teacher');
const Feedback = require('../models/Feedback');
const Department = require('../models/Department');
const teacherAuth = require('../middleware/teacherAuth');
const { sendVerificationEmail } = require('../utils/sendEmail');

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
      teacher = await Teacher.create({
        name: user.name,
        email: user.email,
        department: user.department,
        designation: user.designation
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
      // Also try matching by name + department
      const query = { name: user.name };
      if (user.department) query.department = user.department;
      teacher = await Teacher.findOne(query);
    }

    if (!teacher) {
      // Create a new Teacher profile
      // Department is required — use the user's department or find a default
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
      // Update email on existing teacher if missing
      if (!teacher.email) {
        teacher.email = user.email;
        await teacher.save();
      }
    }

    user.teacher = teacher._id;
    await user.save();

    // Generate JWT
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
          avgStructure: 0,
          avgDelivery: 0,
          avgDuration: 0,
          avgEnvironment: 0,
          avgSkill: 0,
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
      c.avgOverall = +(c.feedbacks.reduce((s, f) => s + (f.courseRating?.overall || 0), 0) / n).toFixed(2);
      c.avgStructure = +(c.feedbacks.reduce((s, f) => s + (f.courseRating?.structure || 0), 0) / n).toFixed(2);
      c.avgDelivery = +(c.feedbacks.reduce((s, f) => s + (f.courseRating?.delivery || 0), 0) / n).toFixed(2);
      c.avgDuration = +(c.feedbacks.reduce((s, f) => s + (f.courseRating?.duration || 0), 0) / n).toFixed(2);
      c.avgEnvironment = +(c.feedbacks.reduce((s, f) => s + (f.courseRating?.environment || 0), 0) / n).toFixed(2);
      c.avgSkill = +(c.feedbacks.reduce((s, f) => s + (f.courseRating?.skill || 0), 0) / n).toFixed(2);
      delete c.feedbacks; // Don't send all feedbacks in dashboard overview
      return c;
    });

    // Overall summary
    const totalFeedbacks = feedbacks.length;
    const overallAvg = totalFeedbacks > 0
      ? +(feedbacks.reduce((s, f) => s + (f.courseRating?.overall || 0), 0) / totalFeedbacks).toFixed(2)
      : 0;
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    feedbacks.forEach(f => sentimentCounts[f.sentiment || 'neutral']++);

    res.json({
      teacher,
      summary: {
        totalFeedbacks,
        totalCourses: courses.length,
        overallAvg,
        avgStructure: teacher?.avgStructure || 0,
        avgDelivery: teacher?.avgDelivery || 0,
        avgDuration: teacher?.avgDuration || 0,
        avgEnvironment: teacher?.avgEnvironment || 0,
        avgSkill: teacher?.avgSkill || 0,
        sentimentCounts,
      },
      courses,
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
    const summary = {
      courseName,
      totalFeedbacks: feedbacks.length,
      avgOverall: +(feedbacks.reduce((s, f) => s + (f.courseRating?.overall || 0), 0) / n).toFixed(2),
      avgStructure: +(feedbacks.reduce((s, f) => s + (f.courseRating?.structure || 0), 0) / n).toFixed(2),
      avgDelivery: +(feedbacks.reduce((s, f) => s + (f.courseRating?.delivery || 0), 0) / n).toFixed(2),
      avgDuration: +(feedbacks.reduce((s, f) => s + (f.courseRating?.duration || 0), 0) / n).toFixed(2),
      avgEnvironment: +(feedbacks.reduce((s, f) => s + (f.courseRating?.environment || 0), 0) / n).toFixed(2),
      avgSkill: +(feedbacks.reduce((s, f) => s + (f.courseRating?.skill || 0), 0) / n).toFixed(2),
    };

    res.json({ summary, feedbacks });
  } catch (error) {
    console.error('Course feedback error:', error);
    res.status(500).json({ message: 'Failed to load course feedback' });
  }
});

// ══════════════════════════════════════════
//  GET /course-feedback/:courseName/export — Download .xlsx (3 sheets)
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

    // Get teacher info for headers
    const teacher = await Teacher.findById(req.teacherId).populate('department', 'name code');
    const teacherName = teacher?.name || 'Unknown';
    const teacherDesignation = teacher?.designation || '';
    const deptName = teacher?.department?.name || feedbacks[0]?.department?.name || 'Unknown';
    const totalStudents = feedbacks.length;

    // Load template using xlsx-populate
    const templatePath = path.join(__dirname, '..', 'feedback_template.xlsx');
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);

    const ws = workbook.sheet('Input');

    // Clear existing data rows in Input sheet (A4 to AF1000)
    for (let r = 4; r <= 1000; r++) {
      for (let c = 1; c <= 32; c++) {
        const cell = ws.row(r).cell(c);
        if (cell.value() !== undefined) {
          cell.value(undefined);
        }
      }
    }

    // Populate actual data
    feedbacks.forEach((fb, idx) => {
      const rowNum = idx + 4;
      const row = ws.row(rowNum);

      row.cell(1).value(idx + 1); // Student No

      // Course Content
      row.cell(2).value(scoreToLabel(fb.courseContent?.q1));
      row.cell(3).value(scoreToLabel(fb.courseContent?.q2));
      row.cell(4).value(scoreToLabel(fb.courseContent?.q3));
      row.cell(5).value(fb.courseContent?.comment || '');

      // Student Contribution
      row.cell(6).value(scoreToLabel(fb.studentContribution?.q5));
      row.cell(7).value(scoreToLabel(fb.studentContribution?.q6));
      row.cell(8).value(fb.studentContribution?.comment || '');

      // Learning Environment
      row.cell(9).value(scoreToLabel(fb.learningEnvironment?.q8));
      row.cell(10).value(scoreToLabel(fb.learningEnvironment?.q9));
      row.cell(11).value(scoreToLabel(fb.learningEnvironment?.q10));
      row.cell(12).value(scoreToLabel(fb.learningEnvironment?.q11));
      row.cell(13).value(fb.learningEnvironment?.comment || '');

      // Learning Resources
      row.cell(14).value(scoreToLabel(fb.learningResources?.q13));
      row.cell(15).value(scoreToLabel(fb.learningResources?.q14));
      row.cell(16).value(scoreToLabel(fb.learningResources?.q15));
      row.cell(17).value(fb.learningResources?.comment || '');

      // Course Teacher
      row.cell(18).value(scoreToLabel(fb.courseTeacher?.q17));
      row.cell(19).value(scoreToLabel(fb.courseTeacher?.q18));
      row.cell(20).value(scoreToLabel(fb.courseTeacher?.q19));
      row.cell(21).value(scoreToLabel(fb.courseTeacher?.q20));
      row.cell(22).value(scoreToLabel(fb.courseTeacher?.q21));
      row.cell(23).value(scoreToLabel(fb.courseTeacher?.q22));
      row.cell(24).value(fb.courseTeacher?.comment || '');

      // Course Rating
      row.cell(25).value(fb.courseRating?.structure || '');
      row.cell(26).value(fb.courseRating?.delivery || '');
      row.cell(27).value(fb.courseRating?.duration || '');
      row.cell(28).value(fb.courseRating?.environment || '');
      row.cell(29).value(fb.courseRating?.skill || '');
      row.cell(30).value(fb.courseRating?.overall || '');
      row.cell(31).value(fb.courseRating?.comment || '');

      // Overall Feedback
      row.cell(32).value(fb.overallFeedback || '');
    });

    // ── Update Graphs Sheet ──
    const gs = workbook.sheet('Graphs');

    // Expand all COUNTIF formulas from row 68 to 1000 to handle any number of students
    gs.usedRange().forEach(cell => {
      const f = cell.formula();
      if (f && f.includes('68')) {
        cell.formula(f.replace(/68/g, '1000'));
      }
    });

    // Override F2 with the actual student count (replaces the formula)
    gs.cell('F2').value(totalStudents);

    // ── Update Final Feedback Sheet ──
    const ff = workbook.sheet('Final Feedback');

    ff.cell('A1').value(`Department of ${deptName}`);
    ff.cell('A3').value(`Students' Feedback on ${courseName}`);
    ff.cell('A4').value(`Course Teacher: ${teacherName}, ${teacherDesignation}, Dept of ${teacher?.department?.code || ''}`);
    ff.cell('A5').value(`Total Responses: ${totalStudents}`);

    // Aggregate unique non-empty comments
    function collectComments(sectionKey) {
      const comments = [];
      feedbacks.forEach(fb => {
        const c = fb[sectionKey]?.comment;
        if (c && c.trim() && c.trim().toLowerCase() !== 'no comments') {
          comments.push(c.trim());
        }
      });
      return [...new Set(comments)].join('; ') || 'No comments';
    }

    // Overwrite the specific comment rows mapped in the template
    ff.cell('B13').value(`Comments (if any): ${collectComments('courseContent')}`);
    ff.cell('B18').value(`Comments (if any): ${collectComments('studentContribution')}`);
    ff.cell('B25').value(`Comments (if any): ${collectComments('learningEnvironment')}`);
    ff.cell('B31').value(`Comments (if any): ${collectComments('learningResources')}`);
    ff.cell('B41').value(`Comments (if any): ${collectComments('courseTeacher')}`);
    ff.cell('B52').value(`Comments (if any): ${collectComments('courseRating')}`);

    // ── Send file ──
    const filename = `Student_Feedback_${courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const buffer = await workbook.outputAsync();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Failed to export feedback' });
  }
});

module.exports = router;

