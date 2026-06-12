const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ruet-feedback-secret-key-2026';

// Middleware to verify teacher JWT token
const teacherAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Teacher authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'teacher') {
      return res.status(403).json({ message: 'Teacher access required' });
    }

    req.teacherUserId = decoded.id;
    req.teacherId = decoded.teacherId; // linked Teacher profile ID
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token. Please login again.' });
  }
};

module.exports = teacherAuth;
