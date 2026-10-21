const express = require('express');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Department = require('../models/Department');
const studentAuth = require('../middleware/studentAuth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ruet-feedback-secret-2026';

// POST /api/students/register
router.post('/register', async (req, res) => {
  try {
    const { roll, name, email, password, departmentId, series } = req.body;

    // Validation
    if (!roll || !name || !email || !password) {
      return res.status(400).json({ message: 'Roll number, name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const trimmedRoll = String(roll).trim();

    // Check if roll already exists
    const existingRoll = await Student.findOne({ roll: trimmedRoll });
    if (existingRoll) {
      return res.status(400).json({ message: 'This roll number is already registered' });
    }

    // Check if email already exists
    const existingEmail = await Student.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: 'This email is already registered' });
    }

    // Derive series from roll if not provided
    const derivedSeries = (series && series.trim()) ? series.trim() : (trimmedRoll.length >= 2 ? trimmedRoll.substring(0, 2) : '');

    // Create student
    const student = new Student({
      roll: trimmedRoll,
      name,
      email: email.toLowerCase(),
      password,
      department: departmentId || undefined,
      series: derivedSeries,
    });

    await student.save();
    if (student.department) {
      await student.populate('department', 'name code');
    }

    // Generate JWT
    const token = jwt.sign(
      { id: student._id, role: 'student', roll: student.roll },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      student: {
        id: student._id,
        roll: student.roll,
        name: student.name,
        email: student.email,
        series: student.series,
        department: student.department,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// POST /api/students/login
router.post('/login', async (req, res) => {
  try {
    const { roll, password } = req.body;

    if (!roll || !password) {
      return res.status(400).json({ message: 'Roll number and password are required' });
    }

    const trimmedRoll = String(roll).trim();

    // Find student by roll
    const student = await Student.findOne({ roll: trimmedRoll }).populate('department', 'name code');
    if (!student) {
      return res.status(401).json({ message: 'Invalid roll number or password' });
    }

    // Check password
    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid roll number or password' });
    }

    // Auto-repair series if missing or mismatched with roll
    if (student.roll && student.roll.length >= 2) {
      const rollSeries = student.roll.substring(0, 2);
      if (!student.series || student.series !== rollSeries) {
        student.series = rollSeries;
        await student.save();
      }
    }

    // Auto-heal department if missing or orphaned
    if (!student.department && student.roll && student.roll.length >= 4) {
      const deptDigits = student.roll.substring(2, 4);
      const deptCodeMap = {
        '01': 'CE', '02': 'EEE', '03': 'ME', '04': 'ETE', '05': 'CSE',
        '06': 'IPE', '07': 'MTE', '08': 'MSE', '09': 'CHE', '10': 'CME',
        '11': 'URP', '12': 'BECM', '13': 'ARCH'
      };
      const code = deptCodeMap[deptDigits];
      if (code) {
        const foundDept = await Department.findOne({ code });
        if (foundDept) {
          student.department = foundDept._id;
          await student.save();
          await student.populate('department', 'name code');
        }
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: student._id, role: 'student', roll: student.roll },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      student: {
        id: student._id,
        roll: student.roll,
        name: student.name,
        email: student.email,
        series: student.series,
        department: student.department,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// GET /api/students/me — Get current student profile
router.get('/me', studentAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.studentId)
      .select('-password')
      .populate('department', 'name code');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// PUT /api/students/profile — Update student profile (e.g. department, series)
router.put('/profile', studentAuth, async (req, res) => {
  try {
    const { name, departmentId, series } = req.body;
    const student = await Student.findById(req.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (name) student.name = name.trim();
    if (departmentId) student.department = departmentId;
    if (series) student.series = series.trim();

    await student.save();
    await student.populate('department', 'name code');

    res.json({
      message: 'Profile updated successfully',
      student: {
        id: student._id,
        roll: student.roll,
        name: student.name,
        email: student.email,
        series: student.series,
        department: student.department,
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

module.exports = router;
