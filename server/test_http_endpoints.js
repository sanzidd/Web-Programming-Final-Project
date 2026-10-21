const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    const req = http.request(`http://localhost:5001${path}`, {
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
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

async function testAllHttpRoutes() {
  console.log('\n--- TESTING LIVE HTTP ENDPOINTS (localhost:5001) ---\n');

  // 1. Departments endpoint
  const deptRes = await request('/api/departments');
  console.log('1. GET /api/departments:', deptRes.status, `(Count: ${deptRes.data.length})`);
  if (deptRes.status !== 200 || !deptRes.data.length) throw new Error('GET /api/departments failed');

  // 2. Teachers endpoint
  const teachersRes = await request('/api/teachers');
  console.log('2. GET /api/teachers:', teachersRes.status, `(Count: ${teachersRes.data.length})`);
  if (teachersRes.status !== 200 || !teachersRes.data.length) throw new Error('GET /api/teachers failed');

  // 3. Admin Login
  const adminLoginRes = await request('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: '12345678' }
  });
  console.log('3. POST /api/admin/login:', adminLoginRes.status, adminLoginRes.data.message || '');
  if (adminLoginRes.status !== 200 || !adminLoginRes.data.token) throw new Error('Admin login failed');
  const adminToken = adminLoginRes.data.token;

  // 4. Analytics Overview
  const overviewRes = await request('/api/analytics/overview', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('4. GET /api/analytics/overview:', overviewRes.status, `Feedbacks: ${overviewRes.data.totalFeedbacks}, Teachers: ${overviewRes.data.totalTeachers}`);
  if (overviewRes.status !== 200) throw new Error('GET /api/analytics/overview failed');

  // 5. Admin Assignments
  const assignmentsRes = await request('/api/admin/assignments', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('5. GET /api/admin/assignments:', assignmentsRes.status, `(Count: ${assignmentsRes.data.length})`);
  if (assignmentsRes.status !== 200) throw new Error('GET /api/admin/assignments failed');

  // 6. Analytics endpoints
  const deptAnalyticsRes = await request('/api/analytics/departments', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('6. GET /api/analytics/departments:', deptAnalyticsRes.status, `(Count: ${deptAnalyticsRes.data.length})`);
  if (deptAnalyticsRes.status !== 200) throw new Error('GET /api/analytics/departments failed');

  // 7. Student Login
  const studentLoginRes = await request('/api/students/login', {
    method: 'POST',
    body: { roll: '2204040', password: '12345678' }
  });
  console.log('7. POST /api/students/login:', studentLoginRes.status, studentLoginRes.data.student ? studentLoginRes.data.student.name : studentLoginRes.data.message);
  if (studentLoginRes.status !== 200 || !studentLoginRes.data.token) throw new Error('Student login failed');
  const studentToken = studentLoginRes.data.token;

  // 8. Student me endpoint
  const studentMeRes = await request('/api/students/me', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  console.log('8. GET /api/students/me:', studentMeRes.status, `Name: ${studentMeRes.data.name}, Roll: ${studentMeRes.data.roll}, Series: ${studentMeRes.data.series}`);
  if (studentMeRes.status !== 200) throw new Error('GET /api/students/me failed');

  // 9. Student assigned courses
  const studentCoursesRes = await request('/api/feedback/my-assignments', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  console.log('9. GET /api/feedback/my-assignments:', studentCoursesRes.status, `(Count: ${studentCoursesRes.data.length})`);
  if (studentCoursesRes.status !== 200 || !studentCoursesRes.data.length) throw new Error('GET /api/feedback/my-assignments failed');

  // 10. Review Session public status
  const sessionStatusRes = await request('/api/feedback/session-status');
  console.log('10. GET /api/feedback/session-status:', sessionStatusRes.status, `isOpen: ${sessionStatusRes.data.isOpen}`);
  if (sessionStatusRes.status !== 200) throw new Error('GET /api/feedback/session-status failed');

  console.log('\n✅ ALL 10 CRITICAL HTTP ENDPOINTS VERIFIED & FUNCTIONING FLAWLESSLY!\n');
}

testAllHttpRoutes().catch(err => {
  console.error('❌ HTTP TEST SUITE FAILED:', err);
  process.exit(1);
});
