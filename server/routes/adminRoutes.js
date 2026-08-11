const express = require('express');
const router = express.Router();
const { 
  login, getAssignments, createAssignment, updateAssignment, deleteAssignment, 
  getReviewSession, toggleReviewSession, changePassword,
  exportAssignmentExcel, getAssignmentStatus, toggleAssignmentSession
} = require('../controllers/adminController');
const { auth } = require('../middleware/auth');

router.post('/login', login);
router.post('/change-password', auth, changePassword);

// Course assignment routes
router.get('/assignments', auth, getAssignments);
router.post('/assignments', auth, createAssignment);
router.put('/assignments/:id', auth, updateAssignment);
router.delete('/assignments/:id', auth, deleteAssignment);
router.get('/assignments/:id/export', auth, exportAssignmentExcel);
router.get('/assignments/:id/status', auth, getAssignmentStatus);
router.post('/assignments/:id/toggle-session', auth, toggleAssignmentSession);

// Review session routes
router.get('/session', auth, getReviewSession);
router.post('/session/toggle', auth, toggleReviewSession);

module.exports = router;

