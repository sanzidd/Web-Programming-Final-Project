const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ruet-feedback-secret-key-2026';

const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { auth, JWT_SECRET };
