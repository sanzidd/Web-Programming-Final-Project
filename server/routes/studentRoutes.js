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

    // Create student
    const student = new Student({
      roll: trimmedRoll,
      name,
      email: email.toLowerCase(),
      password,
      department: departmentId || undefined,
      series: series || '',
    });

    await student.save();

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
    const student = await Student.findOne({ roll: trimmedRoll });
    if (!student) {
      return res.status(401).json({ message: 'Invalid roll number or password' });
    }

    // Check password
    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid roll number or password' });
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

module.exports = router;
