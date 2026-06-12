const express = require('express');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
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

    // If previous unverified attempt exists, update it
    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (existing && !existing.isVerified) {
      existing.name = name;
      existing.password = password;
      existing.department = departmentId || undefined;
      existing.designation = designation || '';
      existing.verificationCode = code;
      existing.verificationExpires = expires;
      await existing.save();
    } else {
      await TeacherUser.create({
        name,
        email: email.toLowerCase(),
        password,
        department: departmentId || undefined,
        designation: designation || '',
        verificationCode: code,
        verificationExpires: expires,
      });
    }

    // Send verification email
    let emailSent = false;
    try {
      await sendVerificationEmail(email, code);
      emailSent = true;
    } catch (emailErr) {
      console.error('Email send error:', emailErr.message);
      console.log('⚠️  Verification code for', email, ':', code);
    }

    if (emailSent) {
      res.status(201).json({ 
        message: 'Verification code sent to your email', 
        email: email.toLowerCase(),
        emailSent: true 
      });
    } else {
      // Email failed — return code directly so user can still verify
      res.status(201).json({ 
        message: 'Email service unavailable. Your verification code is shown below.', 
        email: email.toLowerCase(),
        emailSent: false,
        verificationCode: code 
      });
    }
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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RUET Feedback System';

    // ── Shared styles ──
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1D2E' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A2D40' } };
    const subHeaderFont = { bold: true, color: { argb: 'FFB8BECF' }, size: 9, name: 'Calibri' };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FF3A3D50' } },
      left: { style: 'thin', color: { argb: 'FF3A3D50' } },
      bottom: { style: 'thin', color: { argb: 'FF3A3D50' } },
      right: { style: 'thin', color: { argb: 'FF3A3D50' } },
    };

    // ══════════════════════════════════════
    //  SHEET 1: Input (raw student data)
    // ══════════════════════════════════════
    const ws = workbook.addWorksheet('Input');

    // Row 1: Category headers (with merged cells)
    ws.mergeCells('B1:D1');
    ws.getCell('B1').value = 'Course Content and Organization';
    ws.mergeCells('E1:E2');
    ws.getCell('E1').value = 'Comments on  Course Content and Organization questions (if any)';
    ws.mergeCells('F1:G1');
    ws.getCell('F1').value = 'Student Contribution';
    ws.mergeCells('H1:H2');
    ws.getCell('H1').value = 'Comments on   Student Contribution questions (if any)';
    ws.mergeCells('I1:L1');
    ws.getCell('I1').value = 'Learning Environment and Teaching Methods';
    ws.mergeCells('M1:M2');
    ws.getCell('M1').value = 'Comments on  Learning Environment and Teaching Methods questions (if any)';
    ws.mergeCells('N1:P1');
    ws.getCell('N1').value = 'Learning Resources ';
    ws.mergeCells('Q1:Q2');
    ws.getCell('Q1').value = 'Comments on  Learning Resources  questions (if any)';
    ws.mergeCells('R1:W1');
    ws.getCell('R1').value = 'Course Teacher ';
    ws.mergeCells('X1:X2');
    ws.getCell('X1').value = 'Comments on  Course Teacher questions (if any)';
    ws.mergeCells('Y1:AD1');
    ws.getCell('Y1').value = 'Criteria for Rating';
    ws.mergeCells('AE1:AE2');
    ws.getCell('AE1').value = 'Comments on  Course Rating criteria (if any)';
    ws.mergeCells('AF1:AF2');
    ws.getCell('AF1').value = 'Provide feedback to improve the course';

    // Style row 1
    for (let col = 1; col <= 32; col++) {
      const cell = ws.getCell(1, col);
      cell.fill = headerFill; cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    }

    // Row 2: Question text headers
    const row2Data = {
      A: 'Student No.',
      B: 'The course objectives were clear',
      C: 'The course workload was manageable',
      D: 'The course was well organized. (e.g. timely access to materials, notification of changes, etc.)',
      F: 'I participated actively in the course',
      G: ' I think I have made progress in this course',
      I: 'I think the course was well structured to achieve the learning outcomes (There was a good balance of lectures)',
      J: 'The learning and teaching methods encouraged participation',
      K: 'The overall environment in the class was conducive to learning',
      L: 'Classrooms were satisfactory',
      N: 'Learning materials (lesson plans, course notes, etc.) were relevant and useful',
      O: 'Recommended reading books etc. were relevant and appropriate',
      P: 'The provision of learning resources in the library was adequate and appropriate',
      R: 'Course teacher showed empathy and helped solving critical problems',
      S: 'You felt that course teacher is an expert of this course',
      T: 'Delivery skill of teacher was satisfactory',
      U: 'Course teacher responded to your queries',
      V: 'Communication skill of teacher was satisfactory',
      W: 'You felt comfortable expressing your problems to your course teacher',
      Y: 'Course Structure and Contents',
      Z: 'Delivery Quality of Teacher',
      AA: 'Course Duration',
      AB: 'Environment',
      AC: 'New Skill Acquisition/Old Skill Developed',
      AD: 'Overall Rating',
    };
    Object.entries(row2Data).forEach(([col, val]) => { ws.getCell(`${col}2`).value = val; });

    for (let col = 1; col <= 32; col++) {
      const cell = ws.getCell(2, col);
      cell.fill = subHeaderFill; cell.font = subHeaderFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    }

    // Row 3: Question numbers
    const qCols = ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF'];
    qCols.forEach((col, idx) => { ws.getCell(`${col}3`).value = `Q. ${idx + 1}`; });

    for (let col = 1; col <= 32; col++) {
      const cell = ws.getCell(3, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2237' } };
      cell.font = { bold: true, color: { argb: 'FFC8922A' }, size: 9, name: 'Calibri' };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }

    // Data rows (row 4+)
    feedbacks.forEach((fb, idx) => {
      const rowNum = idx + 4;
      ws.getCell(`A${rowNum}`).value = idx + 1;
      ws.getCell(`B${rowNum}`).value = scoreToLabel(fb.courseContent?.q1);
      ws.getCell(`C${rowNum}`).value = scoreToLabel(fb.courseContent?.q2);
      ws.getCell(`D${rowNum}`).value = scoreToLabel(fb.courseContent?.q3);
      ws.getCell(`E${rowNum}`).value = fb.courseContent?.comment || '';
      ws.getCell(`F${rowNum}`).value = scoreToLabel(fb.studentContribution?.q5);
      ws.getCell(`G${rowNum}`).value = scoreToLabel(fb.studentContribution?.q6);
      ws.getCell(`H${rowNum}`).value = fb.studentContribution?.comment || '';
      ws.getCell(`I${rowNum}`).value = scoreToLabel(fb.learningEnvironment?.q8);
      ws.getCell(`J${rowNum}`).value = scoreToLabel(fb.learningEnvironment?.q9);
      ws.getCell(`K${rowNum}`).value = scoreToLabel(fb.learningEnvironment?.q10);
      ws.getCell(`L${rowNum}`).value = scoreToLabel(fb.learningEnvironment?.q11);
      ws.getCell(`M${rowNum}`).value = fb.learningEnvironment?.comment || '';
      ws.getCell(`N${rowNum}`).value = scoreToLabel(fb.learningResources?.q13);
      ws.getCell(`O${rowNum}`).value = scoreToLabel(fb.learningResources?.q14);
      ws.getCell(`P${rowNum}`).value = scoreToLabel(fb.learningResources?.q15);
      ws.getCell(`Q${rowNum}`).value = fb.learningResources?.comment || '';
      ws.getCell(`R${rowNum}`).value = scoreToLabel(fb.courseTeacher?.q17);
      ws.getCell(`S${rowNum}`).value = scoreToLabel(fb.courseTeacher?.q18);
      ws.getCell(`T${rowNum}`).value = scoreToLabel(fb.courseTeacher?.q19);
      ws.getCell(`U${rowNum}`).value = scoreToLabel(fb.courseTeacher?.q20);
      ws.getCell(`V${rowNum}`).value = scoreToLabel(fb.courseTeacher?.q21);
      ws.getCell(`W${rowNum}`).value = scoreToLabel(fb.courseTeacher?.q22);
      ws.getCell(`X${rowNum}`).value = fb.courseTeacher?.comment || '';
      ws.getCell(`Y${rowNum}`).value = fb.courseRating?.structure || '';
      ws.getCell(`Z${rowNum}`).value = fb.courseRating?.delivery || '';
      ws.getCell(`AA${rowNum}`).value = fb.courseRating?.duration || '';
      ws.getCell(`AB${rowNum}`).value = fb.courseRating?.environment || '';
      ws.getCell(`AC${rowNum}`).value = fb.courseRating?.skill || '';
      ws.getCell(`AD${rowNum}`).value = fb.courseRating?.overall || '';
      ws.getCell(`AE${rowNum}`).value = fb.courseRating?.comment || '';
      ws.getCell(`AF${rowNum}`).value = fb.overallFeedback || '';

      for (let col = 1; col <= 32; col++) {
        const cell = ws.getCell(rowNum, col);
        cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF333333' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
      }
    });

    const totalStudentRows = Math.max(feedbacks.length, 50);
    for (let i = feedbacks.length; i < totalStudentRows; i++) {
      const rowNum = i + 4;
      ws.getCell(`A${rowNum}`).value = i + 1;
      ws.getCell(`A${rowNum}`).border = thinBorder;
    }

    ws.getColumn('A').width = 12;
    ['B','C','D','F','G','I','J','K','L','N','O','P','R','S','T','U','V','W'].forEach(c => ws.getColumn(c).width = 16);
    ['E','H','M','Q','X','AE','AF'].forEach(c => ws.getColumn(c).width = 35);
    ['Y','Z','AA','AB','AC','AD'].forEach(c => ws.getColumn(c).width = 14);
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 60;
    ws.getRow(3).height = 20;

    // ══════════════════════════════════════
    //  Helper: Count Likert distributions
    // ══════════════════════════════════════
    const likertLabels = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];
    const ratingLabels = ['5', '4', '3', '2', '1'];

    function countLikert(feedbacksArr, sectionKey, questionKey) {
      const counts = { 'Strongly Agree': 0, 'Agree': 0, 'Neutral': 0, 'Disagree': 0, 'Strongly Disagree': 0 };
      feedbacksArr.forEach(fb => {
        const score = fb[sectionKey]?.[questionKey];
        const label = scoreToLabel(score);
        if (label && counts[label] !== undefined) counts[label]++;
      });
      return counts;
    }

    function countRating(feedbacksArr, ratingKey) {
      const counts = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
      feedbacksArr.forEach(fb => {
        const val = fb.courseRating?.[ratingKey];
        if (val && counts[String(val)] !== undefined) counts[String(val)]++;
      });
      return counts;
    }

    function toPercent(count, total) {
      return total > 0 ? +((count / total) * 100).toFixed(1) : 0;
    }

    // Aggregate unique non-empty comments
    function collectComments(feedbacksArr, sectionKey) {
      const comments = [];
      feedbacksArr.forEach(fb => {
        const c = fb[sectionKey]?.comment;
        if (c && c.trim() && c.trim().toLowerCase() !== 'no comments') {
          comments.push(c.trim());
        }
      });
      return [...new Set(comments)]; // unique
    }

    // ══════════════════════════════════════
    //  SHEET 2: Graphs (identical to reference)
    // ══════════════════════════════════════
    const gs = workbook.addWorksheet('Graphs');

    // ── Styles matching reference ──
    const gBoldFont = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF000000' } };
    const gYellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    const gRedBoldFont = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FFFF0000' } };

    // Total Participants (C2:E3 merged, F2:F3 merged with count)
    gs.mergeCells('C2:E3');
    gs.getCell('C2').value = 'Total Participants :';
    gs.getCell('C2').fill = gYellowFill;
    gs.getCell('C2').font = gRedBoldFont;
    gs.getCell('C2').alignment = { horizontal: 'center', vertical: 'center' };

    gs.mergeCells('F2:F3');
    gs.getCell('F2').value = totalStudents;
    gs.getCell('F2').fill = gYellowFill;
    gs.getCell('F2').font = gRedBoldFont;
    gs.getCell('F2').alignment = { horizontal: 'center', vertical: 'center' };

    // Row 5: "Criterias" + "Question Nos."
    gs.getCell('B5').value = 'Criterias';
    gs.getCell('B5').font = gBoldFont;
    gs.getCell('B5').alignment = { horizontal: 'center', vertical: 'center' };
    gs.mergeCells('C5:H5');
    gs.getCell('C5').value = 'Question Nos.';
    gs.getCell('C5').font = gBoldFont;
    gs.getCell('C5').alignment = { horizontal: 'center' };

    // ── Helper: write a Graphs section at a specific row ──
    // Matches the reference layout exactly:
    //   Row N:   B = section title (merged B:H)
    //   Row N+1: C,D,E... = Q numbers
    //   Row N+2..N+6: B = label, C,D,E... = percentage values
    function writeGraphSection(startRow, title, qLabels, countsArr, isRating) {
      // Section title
      gs.mergeCells(startRow, 2, startRow, 8);
      gs.getCell(startRow, 2).value = title;
      gs.getCell(startRow, 2).font = gBoldFont;
      gs.getCell(startRow, 2).alignment = { horizontal: 'center', vertical: 'center' };

      // Question labels row
      qLabels.forEach((q, i) => {
        gs.getCell(startRow + 1, 3 + i).value = q;
        gs.getCell(startRow + 1, 3 + i).font = gBoldFont;
        gs.getCell(startRow + 1, 3 + i).alignment = { horizontal: 'center' };
      });

      // Data rows (5 rows of labels/values)
      const labels = isRating
        ? ['5', '4', '3', '2', '1']
        : ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];

      labels.forEach((label, li) => {
        const r = startRow + 2 + li;
        gs.getCell(r, 2).value = label;
        gs.getCell(r, 2).font = { size: 10, name: 'Calibri' };

        countsArr.forEach((counts, qi) => {
          const pct = totalStudents > 0 ? +((counts[label] / totalStudents) * 100).toFixed(1) : 0;
          gs.getCell(r, 3 + qi).value = pct;
          gs.getCell(r, 3 + qi).alignment = { horizontal: 'center' };
        });
      });
    }

    // Count helpers
    function countLikert(sectionKey, questionKey) {
      const c = { 'Strongly Agree': 0, 'Agree': 0, 'Neutral': 0, 'Disagree': 0, 'Strongly Disagree': 0 };
      feedbacks.forEach(fb => { const l = scoreToLabel(fb[sectionKey]?.[questionKey]); if (l) c[l]++; });
      return c;
    }
    function countRating(ratingKey) {
      const c = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
      feedbacks.forEach(fb => { const v = fb.courseRating?.[ratingKey]; if (v) c[String(v)]++; });
      return c;
    }
    function collectComments(sectionKey) {
      const comments = [];
      feedbacks.forEach(fb => {
        const c = fb[sectionKey]?.comment;
        if (c && c.trim() && c.trim().toLowerCase() !== 'no comments') comments.push(c.trim());
      });
      return [...new Set(comments)];
    }

    // Compute all distributions
    const cc1 = countLikert('courseContent', 'q1');
    const cc2 = countLikert('courseContent', 'q2');
    const cc3 = countLikert('courseContent', 'q3');
    const sc5 = countLikert('studentContribution', 'q5');
    const sc6 = countLikert('studentContribution', 'q6');
    const le8 = countLikert('learningEnvironment', 'q8');
    const le9 = countLikert('learningEnvironment', 'q9');
    const le10 = countLikert('learningEnvironment', 'q10');
    const le11 = countLikert('learningEnvironment', 'q11');
    const lr13 = countLikert('learningResources', 'q13');
    const lr14 = countLikert('learningResources', 'q14');
    const lr15 = countLikert('learningResources', 'q15');
    const ct17 = countLikert('courseTeacher', 'q17');
    const ct18 = countLikert('courseTeacher', 'q18');
    const ct19 = countLikert('courseTeacher', 'q19');
    const ct20 = countLikert('courseTeacher', 'q20');
    const ct21 = countLikert('courseTeacher', 'q21');
    const ct22 = countLikert('courseTeacher', 'q22');
    const rs = countRating('structure');
    const rd = countRating('delivery');
    const rdu = countRating('duration');
    const re = countRating('environment');
    const rsk = countRating('skill');
    const ro = countRating('overall');

    // Write sections at exact rows matching reference file
    // Row 7: Course Content (Q1-Q3) → data at rows 8-13
    writeGraphSection(7, 'Course Content and Organization',
      ['Q. 1', 'Q. 2', 'Q. 3'], [cc1, cc2, cc3], false);

    // Row 16: Student Contribution (Q5-Q6) → data at rows 17-22
    writeGraphSection(16, 'Student Contribution',
      ['Q. 5', 'Q. 6'], [sc5, sc6], false);

    // Row 25: Learning Environment (Q8-Q11) → data at rows 26-31
    writeGraphSection(25, 'Learning Environment and Teaching Methods',
      ['Q. 8', 'Q. 9', 'Q. 10', 'Q. 11'], [le8, le9, le10, le11], false);

    // Row 34: Learning Resources (Q13-Q15) → data at rows 35-40
    writeGraphSection(34, 'Learning Resources',
      ['Q. 13', 'Q. 14', 'Q. 15'], [lr13, lr14, lr15], false);

    // Row 43: Course Teacher (Q17-Q22) → data at rows 44-49
    writeGraphSection(43, 'Course Teacher',
      ['Q. 17', 'Q. 18', 'Q. 19', 'Q. 20', 'Q. 21', 'Q. 22'],
      [ct17, ct18, ct19, ct20, ct21, ct22], false);

    // Row 52: Course Rating (Q24-Q29) → data at rows 53-58
    writeGraphSection(52, 'Criteria for Rating',
      ['Q. 24', 'Q. 25', 'Q. 26', 'Q. 27', 'Q. 28', 'Q. 29'],
      [rs, rd, rdu, re, rsk, ro], true);

    // Column widths matching reference
    gs.getColumn('A').width = 8.9;
    gs.getColumn('B').width = 17.8;
    for (let c = 3; c <= 9; c++) gs.getColumn(c).width = 8.9;

    // ══════════════════════════════════════
    //  SHEET 3: Final Feedback (identical layout + charts)
    // ══════════════════════════════════════
    const ff = workbook.addWorksheet('Final Feedback');

    const ffTitleFont = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF000000' } };
    const ffNormalFont = { size: 12, name: 'Calibri', color: { argb: 'FF000000' } };
    const ffSmallFont = { size: 11, name: 'Calibri', color: { argb: 'FF000000' } };
    const ffBoldSection = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF000000' } };

    // Column widths matching reference
    ff.getColumn('A').width = 4.2;
    ff.getColumn('B').width = 23.6;
    ff.getColumn('C').width = 62;

    // Header rows (1-5)
    ff.mergeCells('A1:C1');
    ff.getCell('A1').value = `Department of ${deptName}`;
    ff.getCell('A1').font = ffTitleFont;
    ff.getCell('A1').alignment = { horizontal: 'center', wrapText: true };

    ff.mergeCells('A2:C2');
    ff.getCell('A2').value = 'Rajshahi University of Engineering Technology';
    ff.getCell('A2').font = ffNormalFont;
    ff.getCell('A2').alignment = { horizontal: 'center', wrapText: true };

    ff.mergeCells('A3:C3');
    ff.getCell('A3').value = `Students' Feedback on ${courseName}`;
    ff.getCell('A3').font = ffNormalFont;
    ff.getCell('A3').alignment = { horizontal: 'center', wrapText: true };

    ff.mergeCells('A4:C4');
    ff.getCell('A4').value = `Course Teacher: ${teacherName}, ${teacherDesignation}, Dept of ${teacher?.department?.code || ''}`;
    ff.getCell('A4').font = ffSmallFont;
    ff.getCell('A4').alignment = { horizontal: 'center', wrapText: true };

    ff.mergeCells('A5:C5');
    ff.getCell('A5').value = `Total Responses: ${totalStudents}`;
    ff.getCell('A5').font = ffNormalFont;
    ff.getCell('A5').alignment = { horizontal: 'center' };

    // Row 6: spacer (height=4.2)
    ff.getRow(6).height = 4.2;

    // Row 7: A. CORE QUESTIONS
    ff.mergeCells('A7:C7');
    ff.getCell('A7').value = 'A. CORE QUESTIONS';
    ff.getCell('A7').font = ffBoldSection;
    ff.getCell('A7').alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

    // Row 8: spacer
    ff.getRow(8).height = 4.2;

    // Helper to write a Final Feedback question section (matching reference exactly)
    function writeFinalSection(startRow, sectionTitle, questions, commentKey) {
      // Header row: Sl. | sectionTitle (merged C into same row via merge)
      ff.getCell(`A${startRow}`).value = 'Sl.';
      ff.getCell(`A${startRow}`).font = { bold: true, size: 10, name: 'Calibri' };
      ff.getCell(`B${startRow}`).value = sectionTitle;
      ff.getCell(`B${startRow}`).font = { bold: true, size: 10, name: 'Calibri' };
      
      // Merge C column for the question block (C spans the chart area)
      ff.mergeCells(`C${startRow}:C${startRow + questions.length}`);

      let r = startRow + 1;
      questions.forEach(q => {
        ff.getCell(`A${r}`).value = q.num;
        ff.getCell(`A${r}`).font = { size: 10, name: 'Calibri' };
        ff.getCell(`B${r}`).value = q.text;
        ff.getCell(`B${r}`).font = { size: 10, name: 'Calibri' };
        ff.getCell(`B${r}`).alignment = { wrapText: true };
        r++;
      });

      // Comments row
      const comments = collectComments(commentKey);
      const commentText = comments.length > 0 ? comments.join('; ') : 'No comments';
      ff.getCell(`A${r}`).value = questions[questions.length - 1].num + 1;
      ff.getCell(`A${r}`).font = { size: 10, name: 'Calibri' };
      ff.mergeCells(`B${r}:C${r}`);
      ff.getCell(`B${r}`).value = `Comments (if any): ${commentText}`;
      ff.getCell(`B${r}`).font = { size: 10, name: 'Calibri' };
      ff.getCell(`B${r}`).alignment = { wrapText: true };

      return r + 2; // skip a blank row
    }

    // Section 1: Course Content (Row 9 → 13)
    let fRow = writeFinalSection(9, 'Course Content and Organization', [
      { num: 1, text: 'The course objectives were clear' },
      { num: 2, text: 'The course workload was manageable' },
      { num: 3, text: 'The course was well organized (e.g., timely access to materials, notification of changes etc.)' },
    ], 'courseContent');

    // Section 2: Student Contribution (Row 15 → 18)
    fRow = writeFinalSection(15, 'Student Contribution', [
      { num: 5, text: 'I participated actively in the course' },
      { num: 6, text: 'I think I have made progress in this course' },
    ], 'studentContribution');

    // Section 3: Learning Environment (Row 20 → 25)
    fRow = writeFinalSection(20, 'Learning Environment and Teaching Methods', [
      { num: 8, text: 'I think the course was well structured to achieve the learning outcomes (there was a good balance of lectures)' },
      { num: 9, text: 'The learning and teaching methods encouraged participation' },
      { num: 10, text: 'The overall environment in the class was conductive to learning' },
      { num: 11, text: 'Classrooms were satisfactory' },
    ], 'learningEnvironment');

    // Section 4: Learning Resources (Row 27 → 31)
    fRow = writeFinalSection(27, 'Learning Resources', [
      { num: 13, text: 'Learning materials (Lesson plans, course notes etc.) were relevant and useful' },
      { num: 14, text: 'Recommended reading books etc. were relevant and appropriate' },
      { num: 15, text: 'The provision of learning resources in the library was adequate and appropriate' },
    ], 'learningResources');

    // Row 33: spacer row before Course Teacher
    // Section 5: Course Teacher (Row 34 → 41)
    fRow = writeFinalSection(34, 'Course Teacher', [
      { num: 17, text: 'Course teacher showed empathy and helped solving critical problems' },
      { num: 18, text: 'You felt that course teacher is an expert of this course' },
      { num: 19, text: 'Delivery skill of teacher was satisfactory' },
      { num: 20, text: 'Course teacher responded to your queries' },
      { num: 21, text: 'Communication skill of teacher was satisfactory' },
      { num: 22, text: 'You felt comfortable expressing your problems to your course teacher' },
    ], 'courseTeacher');

    // Row 43: B. COURSE RATING
    ff.mergeCells('A43:C43');
    ff.getCell('A43').value = 'B. COURSE RATING';
    ff.getCell('A43').font = ffBoldSection;
    ff.getCell('A43').alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

    // Section 6: Course Rating (Row 45 → 52)
    ff.getCell('A45').value = 'Sl.';
    ff.getCell('A45').font = { bold: true, size: 10, name: 'Calibri' };
    ff.getCell('B45').value = 'Criteria for Rating';
    ff.getCell('B45').font = { bold: true, size: 10, name: 'Calibri' };
    ff.mergeCells('C45:C51');

    const ratingItems = [
      { num: 24, text: 'Course Structure and Contents' },
      { num: 25, text: 'Delivery Quality of Teacher' },
      { num: 26, text: 'Course Duration' },
      { num: 27, text: 'Environment' },
      { num: 28, text: 'New Skill Acquisition/Old Skill Developed' },
      { num: 29, text: 'Overall Rating' },
    ];
    ratingItems.forEach((item, i) => {
      const r = 46 + i;
      ff.getCell(`A${r}`).value = item.num;
      ff.getCell(`A${r}`).font = { size: 10, name: 'Calibri' };
      ff.getCell(`B${r}`).value = item.text;
      ff.getCell(`B${r}`).font = { size: 10, name: 'Calibri' };
    });

    // Rating comments
    const ratingComments = collectComments('courseRating');
    ff.getCell('A52').value = 30;
    ff.getCell('A52').font = { size: 10, name: 'Calibri' };
    ff.mergeCells('B52:C52');
    ff.getCell('B52').value = `Comments (if any): ${ratingComments.length > 0 ? ratingComments.join('; ') : 'No comments'}`;
    ff.getCell('B52').font = { size: 10, name: 'Calibri' };

    // Row 54: C. ANY OTHER FEEDBACK
    ff.mergeCells('A54:C54');
    ff.getCell('A54').value = 'C. ANY OTHER FEEDBACK';
    ff.getCell('A54').font = ffBoldSection;
    ff.getCell('A54').alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

    // Bullet-point feedbacks starting at row 56
    let bulletRow = 56;
    feedbacks.forEach(fb => {
      if (fb.overallFeedback && fb.overallFeedback.trim()) {
        ff.mergeCells(`A${bulletRow}:C${bulletRow}`);
        ff.getCell(`A${bulletRow}`).value = `• ${fb.overallFeedback}`;
        ff.getCell(`A${bulletRow}`).font = { size: 10, name: 'Calibri' };
        ff.getCell(`A${bulletRow}`).alignment = { wrapText: true };
        bulletRow++;
      }
    });

    // Also add empty bullet rows up to max 65 (like reference which has rows 56-120)
    const maxBulletRow = Math.max(bulletRow, 56 + totalStudentRows);
    for (let r = bulletRow; r <= maxBulletRow; r++) {
      ff.mergeCells(`A${r}:C${r}`);
    }

    // ── 6 Bar Charts on Final Feedback (referencing Graphs data) ──
    // Chart positions match the reference file exactly:
    // Chart 1: from(col=2,row=8) to(col=2,row=11) — Course Content
    // Chart 2: from(col=2,row=14) to(col=2,row=16) — Student Contribution
    // Chart 3: from(col=2,row=19) to(col=2,row=23) — Learning Environment
    // Chart 4: from(col=2,row=26) to(col=2,row=29) — Learning Resources
    // Chart 5: from(col=2,row=33) to(col=2,row=39) — Course Teacher
    // Chart 6: from(col=2,row=44) to(col=2,row=50) — Course Rating

    function createBarChart(ff, title, catRef, seriesRefs, labels, fromRow, toRow) {
      const chart = workbook.addChart('bar', {
        title: { text: '' },
        legend: { position: 'right' },
      });

      labels.forEach((label, i) => {
        chart.addSeries({
          name: `Graphs!$B$${seriesRefs[i]}`,
          categories: catRef,
          values: `Graphs!$C$${seriesRefs[i]}:$${String.fromCharCode(67 + seriesRefs.numCols - 1)}$${seriesRefs[i]}`,
        });
      });

      chart.setSize({ width: 550, height: 280 });

      ff.addChart(chart, {
        tl: { col: 2, row: fromRow },
        br: { col: 6, row: toRow },
      });
    }

    // Since ExcelJS chart API from data references is complex, let's use the Reference approach:
    function addChartFromGraphs(sheetObj, fromRow, toRow, catRowInGraphs, dataStartRow, dataEndRow, numCols) {
      const endColLetter = String.fromCharCode(66 + numCols); // C + numCols - 1

      const chart = workbook.addChart('bar', {});

      // Add 5 series (one for each Likert/rating level)
      for (let i = 0; i < 5; i++) {
        const dataRow = dataStartRow + i;
        chart.addSeries({
          name: `Graphs!$B$${dataRow}`,
          categories: `Graphs!$C$${catRowInGraphs}:$${endColLetter}$${catRowInGraphs}`,
          values: `Graphs!$C$${dataRow}:$${endColLetter}$${dataRow}`,
        });
      }

      chart.setSize({ width: 550, height: 260 });

      sheetObj.addChart(chart, {
        tl: { col: 2, row: fromRow, colOff: 30000, rowOff: 45000 },
        br: { col: 7, row: toRow, colOff: 0, rowOff: 0 },
      });
    }

    // Chart 1: Course Content — Graphs rows 8(Q labels), 9-13(data), categories at row 8
    addChartFromGraphs(ff, 8, 12, 8, 9, 13, 3);   // 3 questions (C-E)

    // Chart 2: Student Contribution — Graphs rows 17(Q labels), 18-22(data)
    addChartFromGraphs(ff, 14, 17, 17, 18, 22, 2);  // 2 questions (C-D)

    // Chart 3: Learning Environment — Graphs rows 26(Q labels), 27-31(data)
    addChartFromGraphs(ff, 19, 24, 26, 27, 31, 4);  // 4 questions (C-F)

    // Chart 4: Learning Resources — Graphs rows 35(Q labels), 36-40(data)
    addChartFromGraphs(ff, 26, 30, 35, 36, 40, 3);  // 3 questions (C-E)

    // Chart 5: Course Teacher — Graphs rows 44(Q labels), 45-49(data)
    addChartFromGraphs(ff, 33, 40, 44, 45, 49, 6);  // 6 questions (C-H)

    // Chart 6: Course Rating — Graphs rows 53(Q labels), 54-58(data)
    addChartFromGraphs(ff, 44, 51, 53, 54, 58, 6);  // 6 rating criteria (C-H)

    // ── Send file ──
    const filename = `Student_Feedback_${courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Failed to export feedback' });
  }
});

module.exports = router;


