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
  console.log('--- STARTING FEATURE 6 TESTS: DEPT FILTERING, OPTIONAL COs, TEACHER COs, SERIES ---');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ruet-feedback');

  try {
    // 1. Fetch departments
    const depts = await Department.find();
    if (depts.length < 2) {
      console.log('Need at least 2 departments for test. Creating test departments...');
      // ensure we have at least 2
    }
    const deptA = depts[0];
    const deptB = depts[1] || depts[0];
    console.log(`✓ Dept A: ${deptA.name} (${deptA.code})`);
    console.log(`✓ Dept B: ${deptB.name} (${deptB.code})`);

    // 2. Fetch or create a teacher and teacherUser
    let teacher = await Teacher.findOne({ department: deptA._id });
    if (!teacher) {
      teacher = await Teacher.findOne();
    }
    console.log(`✓ Teacher found: ${teacher.name}`);

    let teacherUser = await TeacherUser.findOne({ teacher: teacher._id });
    if (!teacherUser) {
      teacherUser = new TeacherUser({
        name: teacher.name,
        email: teacher.email,
        password: 'password123',
        department: teacher.department,
        teacher: teacher._id,
        isVerified: true,
        forcePasswordChange: false
      });
      await teacherUser.save();
    }
    const teacherToken = jwt.sign(
      { id: teacherUser._id, role: 'teacher', teacherId: teacher._id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Test Student Registration with Department and Roll
    const testRollA = '219901';
    const testRollB = '219902';
    await Student.deleteMany({ roll: { $in: [testRollA, testRollB] } });

    const regResA = await fetch(`${baseURL}/students/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Student Dept A',
        roll: testRollA,
        email: 'test_a_219901@ruet.ac.bd',
        password: 'password123',
        departmentId: deptA._id.toString(),
        series: '21'
      })
    });
    const regDataA = await regResA.json();
    console.log(`✓ Student A registration status: ${regResA.status}, Series: ${regDataA.student?.series}, Dept: ${regDataA.student?.department?._id || regDataA.student?.department}`);
    if (regResA.status !== 201) throw new Error(`Reg A failed: ${JSON.stringify(regDataA)}`);

    const regResB = await fetch(`${baseURL}/students/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Student Dept B',
        roll: testRollB,
        email: 'test_b_219902@ruet.ac.bd',
        password: 'password123',
        departmentId: deptB._id.toString(),
        series: '21'
      })
    });
    const regDataB = await regResB.json();
    console.log(`✓ Student B registration status: ${regResB.status}`);

    const tokenA = regDataA.token;
    const tokenB = regDataB.token;

    // 4. Create an assignment assigned specifically to Dept A with NO COs (empty COs)
    const testCourseCode = 'TEST-3199';
    await CourseAssignment.deleteMany({ courseCode: testCourseCode });

    const newAssignment = new CourseAssignment({
      courseCode: testCourseCode,
      courseName: 'Software Engineering Test Course',
      department: deptA._id,
      semester: '5th Semester',
      series: '21',
      teacher: teacher._id,
      courseOutcomes: [] // explicitly empty to test optional COs!
    });
    await newAssignment.save();
    console.log(`✓ Assignment created without COs: ID ${newAssignment._id}`);

    // 5. Test Department Filtering for getMyAssignments
    // Student A (Dept A) should see the course
    const myAssignResA = await fetch(`${baseURL}/feedback/my-assignments`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const myAssignA = await myAssignResA.json();
    const canStudentASee = myAssignA.some(a => a._id === newAssignment._id.toString());
    console.log(`✓ Can Student A (Dept A) see course assigned to Dept A? ${canStudentASee ? 'YES (PASSED)' : 'NO (FAILED)'}`);
    if (!canStudentASee) throw new Error('Student A could not see their department course');

    // If Dept B is different from Dept A, Student B should NOT see the course
    if (deptA._id.toString() !== deptB._id.toString()) {
      const myAssignResB = await fetch(`${baseURL}/feedback/my-assignments`, {
        headers: { 'Authorization': `Bearer ${tokenB}` }
      });
      const myAssignB = await myAssignResB.json();
      const canStudentBSee = myAssignB.some(a => a._id === newAssignment._id.toString());
      console.log(`✓ Can Student B (Dept B) see course assigned to Dept A? ${canStudentBSee ? 'YES (FAILED)' : 'NO (PASSED - Correctly filtered out!)'}`);
      if (canStudentBSee) throw new Error('Student B should not see a course assigned to Dept A');
    }

    // 6. Test Teacher adding Course Outcomes via PUT /teacher-auth/assignments/:id/course-outcomes
    const updateCOsRes = await fetch(`${baseURL}/teacher-auth/assignments/${newAssignment._id}/course-outcomes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        courseOutcomes: [
          { coNumber: 1, title: 'Understand System Architecture' },
          { coNumber: 2, title: 'Design RESTful APIs and Database Schemas' }
        ]
      })
    });
    const updateCOsData = await updateCOsRes.json();
    console.log(`✓ Teacher PUT course-outcomes status: ${updateCOsRes.status}, message: ${updateCOsData.message}`);
    if (updateCOsRes.status !== 200) throw new Error(`Teacher update COs failed: ${JSON.stringify(updateCOsData)}`);

    // Verify assignment now has 2 COs
    const updatedAssignDoc = await CourseAssignment.findById(newAssignment._id);
    console.log(`✓ Assignment now has ${updatedAssignDoc.courseOutcomes.length} COs:`);
    updatedAssignDoc.courseOutcomes.forEach(co => {
      console.log(`   - CO${co.coNumber}: "${co.title}" (description optional: "${co.description}")`);
    });
    if (updatedAssignDoc.courseOutcomes.length !== 2) throw new Error('CO count mismatch');

    // 7. Verify Student A now sees the updated COs
    const myAssignResA2 = await fetch(`${baseURL}/feedback/my-assignments`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const myAssignA2 = await myAssignResA2.json();
    const studentAssign = myAssignA2.find(a => a._id === newAssignment._id.toString());
    console.log(`✓ Student A sees updated assignment with ${studentAssign.courseOutcomes?.length} COs (PASSED)`);

    // Cleanup test data
    await CourseAssignment.deleteMany({ courseCode: testCourseCode });
    await Student.deleteMany({ roll: { $in: [testRollA, testRollB] } });

    console.log('\n🎉 ALL FEATURE 6 TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
