const express = require('express');
const router = express.Router();
const { getDepartments, getDepartment } = require('../controllers/departmentController');

router.get('/', getDepartments);
router.get('/:id', getDepartment);

module.exports = router;
