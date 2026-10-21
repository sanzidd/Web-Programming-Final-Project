const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const TeacherUser = require('./models/TeacherUser');
const Department = require('./models/Department');
const Admin = require('./models/Admin');
const CourseAssignment = require('./models/CourseAssignment');
const Feedback = require('./models/Feedback');
const FeedbackLog = require('./models/FeedbackLog');
const ReviewSession = require('./models/ReviewSession');

const { submitFeedback, getMyAssignments } = require('./controllers/feedbackController');
const { generateFeedbackExcel } = require('./services/excelReportGenerator');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruet-feedback';

async function runMasterTestSuite() {
  console.log('\n======================================================');
  console.log('   RUET FEEDBACK SYSTEM — MASTER VERIFICATION SUITE   ');
  console.log('======================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB at:', MONGO_URI);

  // ─── TEST 1: Database Baseline & Departments ───────────────────────
  console.log('\n[Test 1] Verifying Departments & Teachers baseline...');
  const deptCount = await Department.countDocuments();
  if (deptCount < 10) throw new Error(`Expected at least 10 departments, found ${deptCount}`);
  const teacherCount = await Teacher.countDocuments();
  if (teacherCount < 10) throw new Error(`Expected at least 10 teachers, found ${teacherCount}`);
  console.log(`✅ Baseline verified: ${deptCount} departments, ${teacherCount} teachers.`);

  // ─── TEST 2: Review Session Baseline ──────────────────────────────
  console.log('\n[Test 2] Verifying Global Review Session...');
  const session = await ReviewSession.getCurrentSession();
  session.isOpen = true;
  await session.save();
  console.log(`✅ Review Session is OPEN: "${session.sessionName}"`);

  // ─── TEST 3: Student Flow (Register, Login, Series & Dept) ────────
  console.log('\n[Test 3] Testing Student Registration & Login...');
  const testRoll = '2204999';
  await Student.deleteMany({ roll: testRoll });
  
  const eteDept = await Department.findOne({ code: 'ETE' });
  if (!eteDept) throw new Error('ETE department not found');

  const student = new Student({
    roll: testRoll,
    name: 'Master Test Student',
    email: 'mastertest_student@ruet.ac.bd',
    password: 'password123',
    department: eteDept._id,
    series: '22'
  });
  await student.save();
  console.log(`✅ Student registered: Roll ${student.roll}, Series: ${student.series}, Dept: ETE`);

  // Verify comparePassword
  const isMatch = await student.comparePassword('password123');
  if (!isMatch) throw new Error('Student password mismatch');
  console.log('✅ Student password verification passed');

  // ─── TEST 4: Course Assignment & Visibility ───────────────────────
  console.log('\n[Test 4] Testing Course Assignment Visibility...');
  const eteTeacher = await Teacher.findOne({ department: eteDept._id });
  if (!eteTeacher) throw new Error('ETE teacher not found');

  const testAssignmentCode = 'ETE 9999';
  await CourseAssignment.deleteMany({ courseCode: testAssignmentCode });

  const assignment = await CourseAssignment.create({
    courseCode: testAssignmentCode,
    courseName: 'Master Test Systems',
    department: eteDept._id,
    teacherDepartment: eteDept._id,
    semester: '8th Semester',
    series: '22',
    teacher: eteTeacher._id,
    isReviewSessionOpen: true,
    isActive: true,
    courseOutcomes: [
      { coNumber: 1, title: 'Master Outcome 1', description: 'Description 1' },
      { coNumber: 2, title: 'Master Outcome 2', description: 'Description 2' }
    ]
  });
  console.log(`✅ Course Assignment created: ${assignment.courseCode} — ${assignment.courseName} (Series 22)`);

  // Call getMyAssignments for student
  let retrievedCourses = null;
  const mockReq = { studentId: student._id };
  const mockRes = {
    json: (data) => { retrievedCourses = data; },
    status: (code) => ({ json: (d) => { console.error('Status Error:', code, d); } })
  };
  await getMyAssignments(mockReq, mockRes);

  const foundTarget = retrievedCourses.find(c => c._id.toString() === assignment._id.toString());
  if (!foundTarget) {
    throw new Error('Assigned course NOT found in getMyAssignments for enrolled series student!');
  }
  if (foundTarget.isReviewSessionOpen !== true) {
    throw new Error('isReviewSessionOpen should be true');
  }
  if (foundTarget.alreadyReviewed !== false) {
    throw new Error('alreadyReviewed should be false initially');
  }
  console.log(`✅ Student successfully received assigned course: ${foundTarget.courseName} (Open: ${foundTarget.isReviewSessionOpen})`);

  // ─── TEST 5: Feedback Submission Flow (OBE & Anonymity) ───────────
  console.log('\n[Test 5] Testing Feedback Submission...');
  const feedbackPayload = {
    assignmentId: assignment._id.toString(),
    teacher: eteTeacher._id.toString(),
    department: eteDept._id.toString(),
    courseName: assignment.courseName,
    courseContentOrg: { q1_objectives: 5, q2_workload: 4, q3_organized: 5, comment: 'Great structure' },
    coFeedback: [
      { coNumber: 1, q1_achievement: 5, q2_alignment: 5, q3_assessment: 5, comment: 'Attained' },
      { coNumber: 2, q1_achievement: 4, q2_alignment: 4, q3_assessment: 5, comment: 'Attained' }
    ],
    teachingLearning: { q1_structured: 5, q2_participation: 5, q3_materials: 4, q4_assessment: 5, comment: 'Engaging' },
    academicFacilities: { q1_environment: 4, q2_classrooms: 4, q3_laboratory: 5, comment: 'Modern lab' }
  };

  let submitStatusCode = 200;
  let submitResponse = null;
  const mockResSubmit = {
    status: (code) => {
      submitStatusCode = code;
      return { json: (d) => { submitResponse = d; } };
    },
    json: (d) => { submitResponse = d; }
  };

  await submitFeedback({ studentId: student._id, body: feedbackPayload }, mockResSubmit);
  if (submitStatusCode !== 200 && submitStatusCode !== 201) {
    throw new Error(`Feedback submission failed with status ${submitStatusCode}: ${JSON.stringify(submitResponse)}`);
  }
  console.log('✅ Feedback successfully submitted');

  // Verify Anonymity in Feedback collection: student field must NOT exist
  const savedFeedback = await Feedback.findOne({ courseName: assignment.courseName, teacher: eteTeacher._id });
  if (!savedFeedback) throw new Error('Saved feedback not found in database');
  if (savedFeedback.student || savedFeedback.studentId || savedFeedback.roll) {
    throw new Error('CRITICAL ANONYMITY LEAK: Student identifier found in Feedback document!');
  }
  console.log('✅ Anonymity verified: Zero student identifiers stored in Feedback collection');

  // Verify Duplicate Prevention via FeedbackLog
  const feedbackLog = await FeedbackLog.findOne({ student: student._id, assignment: assignment._id });
  if (!feedbackLog) throw new Error('FeedbackLog missing for student submission');
  console.log('✅ FeedbackLog recorded for duplicate submission prevention');

  // Attempt duplicate submission
  let dupStatus = 200;
  const mockResDup = {
    status: (code) => { dupStatus = code; return { json: () => {} }; },
    json: () => {}
  };
  await submitFeedback({ studentId: student._id, body: feedbackPayload }, mockResDup);
  if (dupStatus !== 409) {
    throw new Error(`Expected 409 Conflict on duplicate submission, got ${dupStatus}`);
  }
  console.log('✅ Duplicate submission successfully prevented (Status 409 Conflict)');

  // ─── TEST 6: Excel Report Generation ──────────────────────────────
  console.log('\n[Test 6] Testing Automated Excel Report Generation...');
  const populatedAssignment = await CourseAssignment.findById(assignment._id).populate('teacher department');
  const feedbacksForReport = await Feedback.find({ courseName: assignment.courseName, teacher: eteTeacher._id }).populate('department');
  
  const excelBuffer = await generateFeedbackExcel({ assignment: populatedAssignment, feedbacks: feedbacksForReport });
  if (!excelBuffer || excelBuffer.length < 1000) {
    throw new Error('Excel buffer generation failed or buffer is too small');
  }
  console.log(`✅ Excel report generated successfully (${excelBuffer.length} bytes)`);

  // ─── TEST 7: Teacher Rating Calculation ───────────────────────────
  console.log('\n[Test 7] Verifying Teacher Ratings...');
  const updatedTeacher = await Teacher.findById(eteTeacher._id);
  if (typeof updatedTeacher.avgRating !== 'number' || updatedTeacher.avgRating <= 0) {
    throw new Error('Teacher avgRating was not calculated or is non-positive');
  }
  console.log(`✅ Teacher rating updated: ${updatedTeacher.avgRating.toFixed(2)} / 5.0 (Total: ${updatedTeacher.totalFeedbacks})`);

  // ─── CLEANUP ──────────────────────────────────────────────────────
  console.log('\n[Cleanup] Cleaning up master test artifacts...');
  await Student.deleteMany({ roll: testRoll });
  await CourseAssignment.deleteMany({ courseCode: testAssignmentCode });
  await Feedback.deleteMany({ courseName: assignment.courseName });
  await FeedbackLog.deleteMany({ assignment: assignment._id });
  console.log('✅ Cleanup complete');

  console.log('\n======================================================');
  console.log('  🎉 ALL MASTER SUITE TESTS PASSED 100% SUCCESSFULLY! ');
  console.log('======================================================\n');
}

runMasterTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ MASTER TEST SUITE FAILED:', err);
    process.exit(1);
  });
