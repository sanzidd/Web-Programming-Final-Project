const express = require('express');
const router = express.Router();
const { getTeachers, getTeacher, getTopTeachers, getBottomTeachers } = require('../controllers/teacherController');
const { auth } = require('../middleware/auth');

router.get('/', getTeachers);
router.get('/top', getTopTeachers);
router.get('/bottom', getBottomTeachers);
router.get('/:id', getTeacher);

module.exports = router;
