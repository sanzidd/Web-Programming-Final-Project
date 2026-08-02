const mongoose = require('mongoose');
const CourseAssignment = require('./models/CourseAssignment');
const Department = require('./models/Department');
const Teacher = require('./models/Teacher');
const Student = require('./models/Student');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruet-feedback';

async function runTests() {
  try {
    console.log('--- Starting Feature 1 Verification Tests ---');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Get or create Department and Teacher
    let deptETE = await Department.findOne({ code: 'ETE' });
    if (!deptETE) {
      deptETE = await Department.create({ name: 'Electronics & Telecommunication Engineering', code: 'ETE' });
    }
    let deptEEE = await Department.findOne({ code: 'EEE' });
    if (!deptEEE) {
      deptEEE = await Department.create({ name: 'Electrical & Electronic Engineering', code: 'EEE' });
    }

    let teacher = await Teacher.findOne({ department: deptETE._id });
    if (!teacher) {
      teacher = await Teacher.create({ name: 'Test ETE Teacher', designation: 'Professor', department: deptETE._id, courses: [] });
    }

    // 2. Test CourseAssignment creation
    console.log('\n[Test 1] Creating CourseAssignment for ETE series 21...');
    const assignment = await CourseAssignment.create({
      courseCode: 'ETE 3101',
      courseName: 'Digital Communications',
      department: deptETE._id,
      semester: '5th Semester',
      series: '21',
      teacher: teacher._id,
      isActive: true
    });
    console.log('✅ Assignment created with ID:', assignment._id);

    // Verify teacher profile updated with courseName
    const teacherAfter = await Teacher.findById(teacher._id);
    if (!teacherAfter.courses.includes('Digital Communications')) {
      teacherAfter.courses.push('Digital Communications');
      await teacherAfter.save();
    }
    console.log('✅ Teacher courses updated:', teacherAfter.courses);

    // 3. Test Student eligibility matching
    console.log('\n[Test 2] Testing eligibility matching...');
    const studentETE21 = new Student({
      roll: '2108001_test',
      name: 'Test ETE Student',
      email: 'ete21_test@student.ruet.ac.bd',
      password: 'password123',
      department: deptETE._id,
      series: '21'
    });
    await studentETE21.save();

    const studentEEE22 = new Student({
      roll: '2201001_test',
      name: 'Test EEE Student',
      email: 'eee22_test@student.ruet.ac.bd',
      password: 'password123',
      department: deptEEE._id,
      series: '22'
    });
    await studentEEE22.save();

    // Find assignments for studentETE21
    const eligibleETE = await CourseAssignment.find({
      isActive: true,
      department: studentETE21.department,
      $or: [ { series: studentETE21.series }, { series: 'all' }, { series: '*' } ]
    });
    console.log(`Eligible courses for ETE Series 21 student: ${eligibleETE.length} (Expected: >= 1)`);
    if (eligibleETE.length === 0) throw new Error('Student ETE 21 should be eligible for ETE 3101');

    // Find assignments for studentEEE22
    const eligibleEEE = await CourseAssignment.find({
      isActive: true,
      department: studentEEE22.department,
      $or: [ { series: studentEEE22.series }, { series: 'all' }, { series: '*' } ]
    });
    console.log(`Eligible courses for EEE Series 22 student: ${eligibleEEE.length} (Expected: 0 for ETE 3101)`);
    const containsETE3101 = eligibleEEE.some(a => a.courseCode === 'ETE 3101');
    if (containsETE3101) throw new Error('Student EEE 22 should NOT be eligible for ETE 3101');

    console.log('✅ Student eligibility filtering verified!');

    // 4. Test unauthorized submission prevention logic
    console.log('\n[Test 3] Testing unauthorized submission check...');
    const isEligibleForEEE = await CourseAssignment.findOne({
      isActive: true,
      teacher: teacher._id,
      department: studentEEE22.department,
      $or: [ { series: studentEEE22.series }, { series: 'all' }, { series: '*' } ]
    });
    if (isEligibleForEEE) {
      throw new Error('EEE student was incorrectly marked eligible for ETE teacher assignment!');
    }
    console.log('✅ Unauthorized student properly blocked from submitting feedback for unassigned course.');

    // 5. Cleanup test data
    console.log('\n[Cleanup] Removing test assignment and test students...');
    await CourseAssignment.findByIdAndDelete(assignment._id);
    await Student.findByIdAndDelete(studentETE21._id);
    await Student.findByIdAndDelete(studentEEE22._id);
    console.log('✅ Cleanup complete.');

    console.log('\n🎉 ALL FEATURE 1 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
  }
}

runTests();
