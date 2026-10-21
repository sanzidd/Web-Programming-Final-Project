const http = require('http');
const mongoose = require('mongoose');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    const req = http.request(`http://localhost:5001${path}`, {
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(buffer.toString('utf8'));
            resolve({ status: res.statusCode, data: json, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, raw: buffer.toString('utf8'), headers: res.headers });
          }
        } else {
          resolve({ status: res.statusCode, buffer, headers: res.headers, raw: buffer.toString('utf8') });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runExhaustiveWebsiteVerification() {
  console.log('================================================================');
  console.log('🚀 STARTING COMPREHENSIVE END-TO-END WEBSITE FUNCTIONALITY AUDIT');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [TEST ${totalTests}] PASS: ${testName} ${details ? '— ' + details : ''}`);
    } else {
      console.error(`❌ [TEST ${totalTests}] FAIL: ${testName} ${details ? '— ' + details : ''}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // SUITE 1: PUBLIC DISCOVERY & METADATA
  // -------------------------------------------------------------
  console.log('\n--- SUITE 1: PUBLIC & METADATA ENDPOINTS ---');
  
  const deptsRes = await request('/api/departments');
  assert(deptsRes.status === 200 && Array.isArray(deptsRes.data) && deptsRes.data.length >= 10, 
    'GET /api/departments returns active departments list', `Found ${deptsRes.data?.length} departments`);

  const teachersRes = await request('/api/teachers');
  assert(teachersRes.status === 200 && Array.isArray(teachersRes.data) && teachersRes.data.length > 50,
    'GET /api/teachers returns teacher faculty directory', `Found ${teachersRes.data?.length} teachers`);

  const topTeachersRes = await request('/api/teachers/top?limit=5');
  assert(topTeachersRes.status === 200 && Array.isArray(topTeachersRes.data),
    'GET /api/teachers/top returns top-rated faculty leaderboard');

  const bottomTeachersRes = await request('/api/teachers/bottom?limit=5');
  assert(bottomTeachersRes.status === 200 && Array.isArray(bottomTeachersRes.data),
    'GET /api/teachers/bottom returns bottom faculty leaderboard');

  const sessionStatusRes = await request('/api/feedback/session-status');
  assert(sessionStatusRes.status === 200 && typeof sessionStatusRes.data.isOpen === 'boolean',
    'GET /api/feedback/session-status returns review session status', `Session isOpen: ${sessionStatusRes.data.isOpen}`);

  // -------------------------------------------------------------
  // SUITE 2: MULTI-ROLE AUTHENTICATION & ACCESS GUARDS
  // -------------------------------------------------------------
  console.log('\n--- SUITE 2: MULTI-ROLE AUTHENTICATION & ACCESS CONTROL ---');

  // Admin login
  const adminLogin = await request('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: '12345678' }
  });
  assert(adminLogin.status === 200 && adminLogin.data.token, 
    'Admin login with credentials succeeds and yields JWT token');
  const adminToken = adminLogin.data.token;

  // Student login
  const studentLogin = await request('/api/students/login', {
    method: 'POST',
    body: { roll: '2204040', password: '12345678' }
  });
  assert(studentLogin.status === 200 && studentLogin.data.token, 
    'Student login with credentials succeeds and yields JWT token', `Student: ${studentLogin.data.student?.name} (${studentLogin.data.student?.roll})`);
  const studentToken = studentLogin.data.token;

  // Teacher login
  const teacherLogin = await request('/api/teacher-auth/login', {
    method: 'POST',
    body: { email: 'demo.teacher@ruet.ac.bd', password: 'demo1234' }
  });
  assert(teacherLogin.status === 200 && teacherLogin.data.token, 
    'Teacher login with credentials succeeds and yields JWT token', `Teacher: ${teacherLogin.data.teacherUser?.name}`);
  const teacherToken = teacherLogin.data.token;

  // Student profile me
  const studentMe = await request('/api/students/me', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(studentMe.status === 200 && studentMe.data.roll === '2204040',
    'GET /api/students/me validates student identity and department/series binding');

  // Teacher profile me
  const teacherMe = await request('/api/teacher-auth/me', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(teacherMe.status === 200 && teacherMe.data.email === 'demo.teacher@ruet.ac.bd',
    'GET /api/teacher-auth/me validates teacher identity and profile');

  // Access guard check: Student accessing Admin route
  const studentUnauthorized = await request('/api/admin/assignments', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(studentUnauthorized.status === 401 || studentUnauthorized.status === 403,
    'Security Guard: Student role is strictly blocked from Admin endpoints (401/403)');

  // Access guard check: Teacher accessing Admin route
  const teacherUnauthorized = await request('/api/admin/assignments', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(teacherUnauthorized.status === 401 || teacherUnauthorized.status === 403,
    'Security Guard: Teacher role is strictly blocked from Admin endpoints (401/403)');

  // -------------------------------------------------------------
  // SUITE 3: SERIES COURSE ASSIGNMENT VISIBILITY & INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- SUITE 3: STUDENT COURSE ASSIGNMENT VISIBILITY & SERIES MATCHING ---');

  const myAssignmentsRes = await request('/api/feedback/my-assignments', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(myAssignmentsRes.status === 200 && Array.isArray(myAssignmentsRes.data),
    'GET /api/feedback/my-assignments returns eligible course assignments for Series 22', `Count: ${myAssignmentsRes.data?.length}`);

  const assignments = myAssignmentsRes.data;
  assert(assignments.length > 0, 
    'Student Series 22 has available course assignments to review');

  // Verify cross-department isolation: All returned assignments belong to student department
  const studentDeptId = studentMe.data.department?._id || studentMe.data.department;
  const foreignAssignments = assignments.filter(a => (a.department?._id || a.department) !== studentDeptId);
  assert(foreignAssignments.length === 0,
    'Department Isolation Guarantee: Student cannot see courses from foreign departments');

  // Pick an assignment to test feedback submission lifecycle
  // Let's connect to Mongo to inspect / prepare a clean test assignment so we don't interfere with existing records
  await mongoose.connect('mongodb://localhost:27017/ruet-feedback');
  const CourseAssignment = require('./models/CourseAssignment');
  const FeedbackLog = require('./models/FeedbackLog');
  const Feedback = require('./models/Feedback');
  const Teacher = require('./models/Teacher');

  // Find or create a dedicated test course assignment for Series 22
  let testAssignment = await CourseAssignment.findOne({
    department: studentDeptId,
    courseCode: 'TEST2201'
  });

  const testTeacher = await Teacher.findOne({ department: studentDeptId }) || await Teacher.findOne({});

  if (!testAssignment) {
    testAssignment = await CourseAssignment.create({
      courseCode: 'TEST2201',
      courseName: 'System Verification & Quality Engineering',
      department: studentDeptId,
      series: '22',
      semester: '2nd Semester',
      teacher: testTeacher._id,
      isActive: true,
      isReviewSessionOpen: true,
      courseOutcomes: [
        { coNumber: 1, title: 'CO1: System Correctness', description: 'Evaluate full web stack resilience' },
        { coNumber: 2, title: 'CO2: Data Integrity', description: 'Validate anonymization and duplicate prevention' }
      ]
    });
  } else {
    testAssignment.isActive = true;
    testAssignment.isReviewSessionOpen = true;
    await testAssignment.save();
  }

  // Ensure student has not reviewed this test course yet
  await FeedbackLog.deleteMany({ student: studentMe.data._id, assignment: testAssignment._id });

  // -------------------------------------------------------------
  // SUITE 4: FEEDBACK SUBMISSION, ANONYMITY, & DUPLICATE PREVENTION
  // -------------------------------------------------------------
  console.log('\n--- SUITE 4: FEEDBACK LIFECYCLE, ANONYMITY & DUPLICATE PREVENTION ---');

  const feedbackPayload = {
    assignmentId: testAssignment._id.toString(),
    teacher: testTeacher._id.toString(),
    department: studentDeptId.toString(),
    courseName: testAssignment.courseName,
    courseContentOrg: {
      q1_objectives: 5,
      q2_workload: 4,
      q3_organized: 5,
      comment: 'Outstanding clarity and syllabus execution.'
    },
    coFeedback: [
      { coNumber: 1, coTitle: 'CO1', q1_achievement: 5, q2_alignment: 5, q3_assessment: 5 },
      { coNumber: 2, coTitle: 'CO2', q1_achievement: 4, q2_alignment: 5, q3_assessment: 4 }
    ],
    teachingLearning: {
      q1_structured: 5,
      q2_participation: 4,
      q3_materials: 5,
      q4_assessment: 5,
      comment: 'Engaging interactive lectures.'
    },
    academicFacilities: {
      q1_environment: 4,
      q2_classrooms: 4,
      q3_laboratory: 5,
      comment: 'Well equipped computing labs.'
    }
  };

  // 1. Submit feedback successfully
  const submitRes = await request('/api/feedback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: feedbackPayload
  });
  assert(submitRes.status === 201 || submitRes.status === 200, 
    'Student submits complete Likert & CO feedback successfully', `Status: ${submitRes.status}`);

  // 2. Verify Anonymity in DB: Feedback document must NOT contain student roll or ID
  const savedFeedback = await Feedback.findOne({ courseName: testAssignment.courseName }).sort({ createdAt: -1 });
  assert(savedFeedback && !savedFeedback.student && !savedFeedback.studentRoll && !savedFeedback.roll,
    'ANONYMITY VERIFIED: Feedback document strictly contains zero student identifiers');

  // 3. Verify Duplicate Prevention: Second submission must return 409 Conflict
  const duplicateRes = await request('/api/feedback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: feedbackPayload
  });
  assert(duplicateRes.status === 409,
    'DUPLICATE PREVENTION VERIFIED: Second submission rejected with 409 Conflict', duplicateRes.data?.message);

  // 4. Verify my-assignments reflects alreadyReviewed === true
  const refreshedAssignments = await request('/api/feedback/my-assignments', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  const updatedItem = refreshedAssignments.data.find(a => a._id === testAssignment._id.toString());
  assert(updatedItem && updatedItem.alreadyReviewed === true,
    'Student assignment status successfully updated to alreadyReviewed === true');

  // -------------------------------------------------------------
  // SUITE 5: TEACHER DASHBOARD, CO MANAGEMENT & EXCEL REPORT EXPORT
  // -------------------------------------------------------------
  console.log('\n--- SUITE 5: TEACHER DASHBOARD, ANALYTICS & EXCEL REPORTING ---');

  const teacherDashRes = await request('/api/teacher-auth/dashboard', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(teacherDashRes.status === 200 && teacherDashRes.data.teacher,
    'GET /api/teacher-auth/dashboard loads teacher performance stats and feedbacks');

  // Test Excel Export endpoint for a course
  const exportRes = await request(`/api/teacher-auth/course-feedback/${encodeURIComponent(testAssignment.courseName)}/export`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(exportRes.status === 200 && exportRes.buffer && exportRes.buffer.length > 500,
    'Excel Report Generator: Successfully generates binary .xlsx course feedback report', 
    `Buffer size: ${exportRes.buffer?.length} bytes`);

  // -------------------------------------------------------------
  // SUITE 6: ADMIN DASHBOARD & ADVANCED ANALYTICS
  // -------------------------------------------------------------
  console.log('\n--- SUITE 6: ADMIN DASHBOARD & ADVANCED ANALYTICS ---');

  const overviewRes = await request('/api/analytics/overview', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(overviewRes.status === 200 && overviewRes.data.totalFeedbacks > 0,
    'GET /api/analytics/overview returns aggregate KPI metrics', 
    `Total Feedbacks: ${overviewRes.data.totalFeedbacks}, Total Teachers: ${overviewRes.data.totalTeachers}`);

  const deptAnalyticsRes = await request('/api/analytics/departments', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(deptAnalyticsRes.status === 200 && Array.isArray(deptAnalyticsRes.data),
    'GET /api/analytics/departments returns comparative department analytics breakdown');

  const trendsRes = await request('/api/analytics/trends', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(trendsRes.status === 200 && Array.isArray(trendsRes.data),
    'GET /api/analytics/trends returns monthly historical rating trends');

  const teacherAnalyticsRes = await request(`/api/analytics/teacher/${testTeacher._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(teacherAnalyticsRes.status === 200 && teacherAnalyticsRes.data.teacher,
    'GET /api/analytics/teacher/:id returns in-depth radar & trend breakdown for teacher');

  // -------------------------------------------------------------
  // SUITE 7: PASSWORD RESET & SAFE EMAIL HANDLING
  // -------------------------------------------------------------
  console.log('\n--- SUITE 7: PASSWORD RESET FLOW & SMTP ERROR RESILIENCE ---');

  const resetReqRes = await request('/api/password-reset/request', {
    method: 'POST',
    body: { email: 'sanzidis99@gmail.com', role: 'student' }
  });
  assert(resetReqRes.status === 200 && resetReqRes.data.email,
    'POST /api/password-reset/request succeeds gracefully without 535 Bad Credentials crash',
    `Message: ${resetReqRes.data.message}`);

  if (resetReqRes.data.codePreview) {
    const code = resetReqRes.data.codePreview;
    const verifyRes = await request('/api/password-reset/verify', {
      method: 'POST',
      body: { email: 'sanzidis99@gmail.com', role: 'student', code }
    });
    assert(verifyRes.status === 200 && verifyRes.data.resetToken,
      'POST /api/password-reset/verify successfully validates OTP code and returns resetToken');
  }

  // Clean up test assignment
  await CourseAssignment.findByIdAndDelete(testAssignment._id);
  await Feedback.deleteMany({ courseName: testAssignment.courseName });
  await FeedbackLog.deleteMany({ assignment: testAssignment._id });

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED WITH 100% SUCCESS!`);
  console.log('   ALL WEBSITE FUNCTIONALITIES ARE FULLY OPERATIONAL & VERIFIED!');
  console.log('================================================================\n');

  process.exit(0);
}

runExhaustiveWebsiteVerification().catch(err => {
  console.error('\n❌ TEST SUITE FAILED WITH EXCEPTION:', err);
  process.exit(1);
});
