const express = require('express');
const router = express.Router();
const { submitFeedback, getFeedbacks, getTeacherFeedbacks, getMyAssignments, getSessionStatus } = require('../controllers/feedbackController');
const { auth } = require('../middleware/auth');
const studentAuth = require('../middleware/studentAuth');

// Public / Student session status
router.get('/session-status', getSessionStatus);

// Student-only — requires student login, but feedback is anonymous
router.post('/', studentAuth, submitFeedback);
router.get('/my-assignments', studentAuth, getMyAssignments);

// Admin only
router.get('/', auth, getFeedbacks);
router.get('/teacher/:teacherId', auth, getTeacherFeedbacks);

module.exports = router;

