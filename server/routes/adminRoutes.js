const express = require('express');
const router = express.Router();
const { 
  login, getAssignments, createAssignment, updateAssignment, deleteAssignment, 
  getReviewSession, toggleReviewSession, changePassword,
  exportAssignmentExcel, exportTeacherExcel, getAssignmentStatus, toggleAssignmentSession,
  sendAssignmentReportEmail, sendBulkReportsEmail,
  getPendingTeachers, approvePendingTeacher, rejectPendingTeacher,
  resetTestData
} = require('../controllers/adminController');
const { auth } = require('../middleware/auth');

router.post('/login', login);
router.post('/change-password', auth, changePassword);

// Reset test data route (clears students, feedbacks, logs, resets teacher ratings to 0)
router.post('/reset-test-data', auth, resetTestData);

// Course assignment routes
router.get('/assignments', auth, getAssignments);
router.post('/assignments', auth, createAssignment);
router.put('/assignments/:id', auth, updateAssignment);
router.delete('/assignments/:id', auth, deleteAssignment);
router.get('/assignments/:id/export', auth, exportAssignmentExcel);
router.get('/teachers/:id/export', auth, exportTeacherExcel);
router.get('/assignments/:id/status', auth, getAssignmentStatus);
router.post('/assignments/:id/toggle-session', auth, toggleAssignmentSession);
router.post('/assignments/:id/send-report', auth, sendAssignmentReportEmail);
router.post('/assignments/send-bulk-reports', auth, sendBulkReportsEmail);

// Review session routes
router.get('/session', auth, getReviewSession);
router.post('/session/toggle', auth, toggleReviewSession);

// Teacher registration approval routes
router.get('/pending-teachers', auth, getPendingTeachers);
router.post('/pending-teachers/:id/approve', auth, approvePendingTeacher);
router.delete('/pending-teachers/:id/reject', auth, rejectPendingTeacher);

module.exports = router;

