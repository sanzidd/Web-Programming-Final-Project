const express = require('express');
const router = express.Router();
const { submitFeedback, getFeedbacks, getTeacherFeedbacks } = require('../controllers/feedbackController');
const { auth } = require('../middleware/auth');
const studentAuth = require('../middleware/studentAuth');

// Student-only — requires student login, but feedback is anonymous
router.post('/', studentAuth, submitFeedback);

// Admin only
router.get('/', auth, getFeedbacks);
router.get('/teacher/:teacherId', auth, getTeacherFeedbacks);

module.exports = router;
