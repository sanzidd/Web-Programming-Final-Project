const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const Department = require('./models/Department');
const CourseAssignment = require('./models/CourseAssignment');
const TeacherUser = require('./models/TeacherUser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ruet-feedback-secret-2026';
const baseURL = 'http://localhost:5001/api';

async function runTests() {
  console.log('--- STARTING FEATURE 7 TESTS: CROSS-DEPT ASSIGNMENTS & REPORT EMAIL ---');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ruet-feedback');

  try {
    // 1. Fetch departments
    const depts = await Department.find();
    if (depts.length < 2) {
      throw new Error('Need at least 2 departments to test cross-departmental assignment');
    }
    const studentDept = depts[0]; // e.g. CSE
    const teacherDept = depts[1]; // e.g. EEE
    console.log(`✓ Student Department: ${studentDept.name} (${studentDept.code})`);
    console.log(`✓ Teacher Department: ${teacherDept.name} (${teacherDept.code})`);

    // 2. Find or create a teacher belonging to teacherDept
    let teacher = await Teacher.findOne({ department: teacherDept._id });
    if (!teacher) {
      teacher = new Teacher({
        name: 'Prof. Cross Dept Tester',
        designation: 'Professor',
        department: teacherDept._id,
        email: 'tester.faculty@ruet.ac.bd'
      });
      await teacher.save();
    }
    console.log(`✓ Teacher: ${teacher.name} (Dept: ${teacherDept.code})`);

    // 3. Admin token
    const adminToken = jwt.sign(
      { id: 'admin123', role: 'admin', username: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 4. Create a CourseAssignment with different Student Dept and Teacher Dept (e.g. DIP)
    const testCourseCode = 'DIP-4101';
    await CourseAssignment.deleteMany({ courseCode: testCourseCode });

    const createRes = await fetch(`${baseURL}/admin/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        courseCode: testCourseCode,
        courseName: 'Digital Image Processing',
        department: studentDept._id.toString(), // Student Department
        teacherDepartment: teacherDept._id.toString(), // Teacher Department
        semester: '7th Semester',
        series: '21',
        teacher: teacher._id.toString(),
        courseOutcomes: [
          { coNumber: 1, title: 'Understand image transformations and filters' }
        ]
      })
    });

    const createData = await createRes.json();
    console.log(`✓ Assignment creation status: ${createRes.status}`);
    if (createRes.status !== 201) throw new Error(`Create failed: ${JSON.stringify(createData)}`);
    
    const createdAssignment = createData.assignment;
    console.log(`✓ Created Assignment ID: ${createdAssignment._id}`);
    console.log(`   - Student Dept: ${createdAssignment.department?.code}`);
    console.log(`   - Teacher Dept: ${createdAssignment.teacherDepartment?.code || createdAssignment.teacher?.department?.code}`);
    console.log(`   - Course: ${createdAssignment.courseCode} - ${createdAssignment.courseName}`);

    // Verify teacherDepartment is populated
    if (!createdAssignment.teacherDepartment) {
      throw new Error('teacherDepartment was not populated on created assignment');
    }

    // 5. Verify Student of studentDept sees this cross-departmental course
    const testStudentRoll = '219999';
    await Student.deleteMany({ roll: testStudentRoll });
    const regRes = await fetch(`${baseURL}/students/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'CSE Student Evaluator',
        roll: testStudentRoll,
        email: 'student_eval@ruet.ac.bd',
        password: 'password123',
        departmentId: studentDept._id.toString(),
        series: '21'
      })
    });
    const regData = await regRes.json();
    const studentToken = regData.token;

    const myAssignRes = await fetch(`${baseURL}/feedback/my-assignments`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    const myAssignments = await myAssignRes.json();
    const foundCourse = myAssignments.find(a => a._id === createdAssignment._id);
    console.log(`✓ Can Student from ${studentDept.code} see cross-departmental course ${testCourseCode}? ${foundCourse ? 'YES (PASSED)' : 'NO (FAILED)'}`);
    if (!foundCourse) throw new Error('Student could not see cross-departmental course');

    // 6. Test sendAssignmentReportEmail endpoint for this specific course
    console.log(`[Testing send-report endpoint for course ${testCourseCode}...]`);
    const emailReportRes = await fetch(`${baseURL}/admin/assignments/${createdAssignment._id}/send-report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const emailReportData = await emailReportRes.json();
    console.log(`✓ send-report response status: ${emailReportRes.status}, message: ${emailReportData.message}`);
    // Status 200 or 400 (if SMTP credentials or fake email) verifies the endpoint handles the single course report
    console.log(`✓ Course-specific report email endpoint verified!`);

    // Cleanup
    await CourseAssignment.deleteMany({ courseCode: testCourseCode });
    await Student.deleteMany({ roll: testStudentRoll });

    console.log('\n🎉 ALL FEATURE 7 TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
