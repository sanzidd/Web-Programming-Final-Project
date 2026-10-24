const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const TeacherUser = require('../models/TeacherUser');
const Admin = require('../models/Admin');
const { sendPasswordResetEmail } = require('../utils/sendEmail');

const JWT_SECRET = process.env.JWT_SECRET || 'ruet-feedback-secret-key-2026';

/**
 * Helper to find user across models by email and role
 */
async function findUserByEmailAndRole(email, role) {
  const cleanEmail = email.toLowerCase().trim();
  if (role === 'student') {
    const user = await Student.findOne({ email: cleanEmail });
    return { user, role: 'student', title: 'Student' };
  } else if (role === 'teacher') {
    const user = await TeacherUser.findOne({ email: cleanEmail });
    return { user, role: 'teacher', title: 'Teacher' };
  } else if (role === 'admin') {
    const user = await Admin.findOne({ email: cleanEmail });
    return { user, role: 'admin', title: 'Admin' };
  } else {
    // Auto-detect role if not explicitly passed
    const student = await Student.findOne({ email: cleanEmail });
    if (student) return { user: student, role: 'student', title: 'Student' };

    const teacher = await TeacherUser.findOne({ email: cleanEmail });
    if (teacher) return { user: teacher, role: 'teacher', title: 'Teacher' };

    const admin = await Admin.findOne({ email: cleanEmail });
    if (admin) return { user: admin, role: 'admin', title: 'Admin' };

    return { user: null, role: null, title: null };
  }
}

// ══════════════════════════════════════════
//  1. POST /api/password-reset/request
// ══════════════════════════════════════════
router.post('/request', async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const { user, role: detectedRole, title } = await findUserByEmailAndRole(email, role);
    if (!user) {
      return res.status(404).json({ message: 'No registered account found with this email address' });
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = code;
    user.resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await user.save();

    // Send email with OTP code
    let emailSent = false;
    let emailErrorMessage = null;
    try {
      const emailResult = await sendPasswordResetEmail(user.email, code, title);
      emailSent = emailResult && Array.isArray(emailResult.accepted) && emailResult.accepted.length > 0;
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr.message);
      emailErrorMessage = emailErr.message;
      emailSent = false;
    }

    if (!emailSent) {
      return res.status(200).json({
        message: emailErrorMessage 
          ? `Could not deliver email: ${emailErrorMessage}. (Code for testing: ${code})` 
          : 'Verification code generated. (Email delivery skipped due to SMTP setup)',
        email: user.email,
        role: detectedRole,
        codePreview: code
      });
    }

    res.json({
      message: `A 6-digit verification code has been sent to ${user.email}`,
      email: user.email,
      role: detectedRole
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: error.message || 'Failed to process password reset request' });
  }
});

// ══════════════════════════════════════════
//  2. POST /api/password-reset/verify
// ══════════════════════════════════════════
router.post('/verify', async (req, res) => {
  try {
    const { email, role, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const { user, role: detectedRole } = await findUserByEmailAndRole(email, role);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.resetCode || user.resetCode !== code.trim()) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (!user.resetCodeExpires || new Date() > new Date(user.resetCodeExpires)) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // Generate reset token valid for 15 minutes
    const resetToken = jwt.sign(
      { email: user.email, role: detectedRole, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      message: 'Code verified successfully',
      resetToken,
      role: detectedRole,
      email: user.email
    });
  } catch (error) {
    console.error('Password reset verify error:', error);
    res.status(500).json({ message: error.message || 'Verification failed' });
  }
});

// ══════════════════════════════════════════
//  3. POST /api/password-reset/reset
// ══════════════════════════════════════════
router.post('/reset', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
      if (decoded.purpose !== 'password_reset') {
        return res.status(400).json({ message: 'Invalid reset token' });
      }
    } catch (jwtErr) {
      return res.status(400).json({ message: 'Reset token is invalid or has expired. Please try again.' });
    }

    const { user } = await findUserByEmailAndRole(decoded.email, decoded.role);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    // Update password
    user.password = newPassword;
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    if (decoded.role === 'teacher') {
      user.forcePasswordChange = false;
    }
    await user.save();

    res.json({
      message: 'Your password has been successfully reset. You can now log in.',
      role: decoded.role
    });
  } catch (error) {
    console.error('Password reset update error:', error);
    res.status(500).json({ message: error.message || 'Failed to update password' });
  }
});

module.exports = router;
