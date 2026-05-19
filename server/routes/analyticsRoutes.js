const express = require('express');
const router = express.Router();
const { getOverview, getDepartmentAnalytics, getSingleDepartmentAnalytics, getTrends, getTeacherAnalytics } = require('../controllers/analyticsController');
const { auth } = require('../middleware/auth');

router.get('/overview', auth, getOverview);
router.get('/departments', auth, getDepartmentAnalytics);
router.get('/departments/:id', auth, getSingleDepartmentAnalytics);
router.get('/trends', auth, getTrends);
router.get('/teacher/:id', auth, getTeacherAnalytics);

module.exports = router;
