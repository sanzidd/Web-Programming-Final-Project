const express = require('express');
const mongoose = require('mongoose');
const TeacherUser = require('./models/TeacherUser');
const CourseAssignment = require('./models/CourseAssignment');
const Department = require('./models/Department');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruet-feedback';

async function runTests() {
  let server;
  try {
    console.log('--- Starting Feature 5 Verification Tests (Teacher Auth, Password Change & Dashboard) ---');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const app = express();
    app.use(express.json());
    app.use('/api/teacher-auth', require('./routes/teacherAuthRoutes'));

    server = app.listen(0);
    const port = server.address().port;
    const baseURL = `http://localhost:${port}/api/teacher-auth`;
    console.log(`✅ Test server running on port ${port}`);

    // Ensure we have a teacher user to test with
    const testEmail = 'kamal@ete.ruet.ac.bd';
    let authUser = await TeacherUser.findOne({ email: testEmail });
    if (!authUser) {
      throw new Error(`Test account ${testEmail} not found! Run Feature 4 migration first.`);
    }

    // Reset password to default '12345678' and forcePasswordChange to true for testing
    authUser.password = '12345678';
    authUser.forcePasswordChange = true;
    await authUser.save();

    // Also ensure at least one CourseAssignment exists for this teacher
    let assignment = await CourseAssignment.findOne({ teacher: authUser.teacher });
    if (!assignment && authUser.teacher && authUser.department) {
      assignment = await CourseAssignment.create({
        semester: '3rd Semester',
        series: '2021',
        courseCode: 'ETE 3101',
        courseName: 'Digital Communication',
        teacher: authUser.teacher,
        department: authUser.department,
        isActive: true
      });
      console.log('✅ Created temporary CourseAssignment for testing.');
    }

    // Test 1: Login with default password
    console.log('\n--- Test 1: Teacher Login ---');
    const loginRes = await fetch(`${baseURL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: '12345678' })
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginData)}`);
    }
    if (loginData.teacherUser.forcePasswordChange !== true) {
      throw new Error(`Expected forcePasswordChange to be true on login, got ${loginData.teacherUser.forcePasswordChange}`);
    }
    const token = loginData.token;
    console.log('✅ Login successful. forcePasswordChange is correctly true.');

    // Test 2: GET /dashboard should return assignedCourses
    console.log('\n--- Test 2: Dashboard Assigned Courses ---');
    const dashRes = await fetch(`${baseURL}/dashboard`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dashData = await dashRes.json();
    if (dashRes.status !== 200) {
      throw new Error(`Dashboard request failed with status ${dashRes.status}: ${JSON.stringify(dashData)}`);
    }
    if (!Array.isArray(dashData.assignedCourses)) {
      throw new Error('Dashboard response missing assignedCourses array!');
    }
    console.log(`✅ Dashboard returned ${dashData.assignedCourses.length} assigned courses.`);

    // Test 3: POST /change-password
    console.log('\n--- Test 3: Password Change ---');
    const changeRes = await fetch(`${baseURL}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword: '12345678', newPassword: 'NewSecretPassword123' })
    });
    const changeData = await changeRes.json();
    if (changeRes.status !== 200 || changeData.forcePasswordChange !== false) {
      throw new Error(`Change password failed: ${JSON.stringify(changeData)}`);
    }
    console.log('✅ Password changed successfully. forcePasswordChange is now false.');

    // Test 4: Verify new password works and forcePasswordChange remains false
    console.log('\n--- Test 4: Verify New Password Login ---');
    const loginRes2 = await fetch(`${baseURL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'NewSecretPassword123' })
    });
    const loginData2 = await loginRes2.json();
    if (loginRes2.status !== 200 || loginData2.teacherUser.forcePasswordChange !== false) {
      throw new Error(`New password login failed or forcePasswordChange incorrect: ${JSON.stringify(loginData2)}`);
    }
    console.log('✅ Verified login with new password and forcePasswordChange=false.');

    // Revert password back to default for clean state
    const userToReset = await TeacherUser.findOne({ email: testEmail });
    userToReset.password = '12345678';
    userToReset.forcePasswordChange = true;
    await userToReset.save();
    console.log('✅ Reverted test account password back to default "12345678" for future use.');

    console.log('\n--- 🎉 ALL FEATURE 5 TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

runTests();
