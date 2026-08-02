const express = require('express');
const router = express.Router();
const { login, getAssignments, createAssignment, updateAssignment, deleteAssignment, getReviewSession, toggleReviewSession, changePassword } = require('../controllers/adminController');
const { auth } = require('../middleware/auth');

router.post('/login', login);
router.post('/change-password', auth, changePassword);

// Course assignment routes
router.get('/assignments', auth, getAssignments);
router.post('/assignments', auth, createAssignment);
router.put('/assignments/:id', auth, updateAssignment);
router.delete('/assignments/:id', auth, deleteAssignment);

// Review session routes
router.get('/session', auth, getReviewSession);
router.post('/session/toggle', auth, toggleReviewSession);

module.exports = router;

