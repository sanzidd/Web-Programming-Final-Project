const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ruet-feedback-secret-2026';

// Middleware to verify student JWT token
// Only verifies authentication — does NOT attach studentId to request body
const studentAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'You must be logged in as a RUET student to perform this action' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'student') {
      return res.status(403).json({ message: 'Student access required' });
    }

    // Attach student info for duplicate-check purposes only
    // This is NOT stored in the feedback record
    req.studentId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token. Please login again.' });
  }
};

module.exports = studentAuth;
