const express = require('express');
const router = express.Router();
const { getTeachers, getTeacher, getTopTeachers, getBottomTeachers, createTeacher, updateTeacher, deleteTeacher } = require('../controllers/teacherController');
const { auth } = require('../middleware/auth');

router.get('/', getTeachers);
router.get('/top', getTopTeachers);
router.get('/bottom', getBottomTeachers);
router.get('/:id', getTeacher);

// Admin-only CRUD routes
router.post('/', auth, createTeacher);
router.put('/:id', auth, updateTeacher);
router.delete('/:id', auth, deleteTeacher);

module.exports = router;
