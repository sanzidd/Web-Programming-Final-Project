const express = require('express');
const router = express.Router();
const {
  login,
  getCourseCatalog,
  upsertCourseCatalogItem,
  updateCourseCatalogItem,
  getAssignments,
  createAssignment,
  updateAssignment,
  updateAssignmentDeadline,
  deleteAssignment,
  getReviewSession,
  toggleReviewSession,
  changePassword,
  getFeedbackQuestionsAdmin,
  updateFeedbackQuestions,
  resetFeedbackQuestions,
  exportAssignmentExcel,
  exportAssignmentWord,
  exportTeacherExcel,
  exportTeacherWord,
  getAssignmentStatus,
  toggleAssignmentSession,
  sendAssignmentReportEmail,
  sendBulkReportsEmail,
  getPendingTeachers,
  approvePendingTeacher,
  rejectPendingTeacher,
  resetTestData
} = require('../controllers/adminController');
const { auth } = require('../middleware/auth');

router.post('/login', login);
router.post('/change-password', auth, changePassword);

// Reset test data route (clears students, feedbacks, logs, resets teacher ratings to 0)
router.post('/reset-test-data', auth, resetTestData);

// Pre-enlisted OBE Course Catalog routes
router.get('/course-catalog', auth, getCourseCatalog);
router.post('/course-catalog', auth, upsertCourseCatalogItem);
router.put('/course-catalog/:id', auth, updateCourseCatalogItem);

// Admin-configurable dynamic feedback questions
router.get('/feedback-questions', auth, getFeedbackQuestionsAdmin);
router.put('/feedback-questions', auth, updateFeedbackQuestions);
router.post('/feedback-questions/reset', auth, resetFeedbackQuestions);

// Course assignment routes
router.get('/assignments', auth, getAssignments);
router.post('/assignments', auth, createAssignment);
router.put('/assignments/:id', auth, updateAssignment);
router.put('/assignments/:id/deadline', auth, updateAssignmentDeadline);
router.delete('/assignments/:id', auth, deleteAssignment);
router.get('/assignments/:id/export', auth, exportAssignmentExcel);
router.get('/assignments/:id/export-doc', auth, exportAssignmentWord);
router.get('/teachers/:id/export', auth, exportTeacherExcel);
router.get('/teachers/:id/export-doc', auth, exportTeacherWord);
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
