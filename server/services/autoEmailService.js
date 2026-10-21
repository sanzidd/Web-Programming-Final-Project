const CourseAssignment = require('../models/CourseAssignment');
const Feedback = require('../models/Feedback');
const Teacher = require('../models/Teacher');
const TeacherUser = require('../models/TeacherUser');
const Department = require('../models/Department');
const { generateFeedbackExcel } = require('./excelReportGenerator');
const { sendFeedbackReportEmail } = require('../utils/sendEmail');

/**
 * Send an XLSX feedback report for a specific assignment to its assigned teacher
 */
async function sendReportForAssignment(assignmentId) {
  const assignment = await CourseAssignment.findById(assignmentId).populate('teacher department');
  if (!assignment) {
    throw new Error('Course assignment not found');
  }

  // Find teacher's email: from Teacher model or registered TeacherUser account
  let teacherEmail = assignment.teacher?.email;
  if (!teacherEmail && assignment.teacher?._id) {
    const teacherUser = await TeacherUser.findOne({ teacher: assignment.teacher._id });
    if (teacherUser) {
      teacherEmail = teacherUser.email;
    }
  }

  if (!teacherEmail) {
    return {
      success: false,
      assignmentId,
      courseName: assignment.courseName,
      teacherName: assignment.teacher?.name,
      reason: 'No registered email found for this teacher'
    };
  }

  // Fetch feedbacks for this teacher and course
  const feedbacks = await Feedback.find({
    teacher: assignment.teacher._id,
    courseName: assignment.courseName
  }).populate('department', 'name code').sort({ createdAt: 1 });

  // Generate Excel buffer
  const buffer = await generateFeedbackExcel({ assignment, feedbacks });
  const filename = `RUET_Feedback_${assignment.courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

  // Email report
  try {
    await sendFeedbackReportEmail(
      teacherEmail,
      assignment.teacher?.name,
      assignment.courseName,
      buffer,
      filename
    );

    return {
      success: true,
      assignmentId,
      courseName: assignment.courseName,
      teacherName: assignment.teacher?.name,
      teacherEmail,
      totalFeedbacks: feedbacks.length
    };
  } catch (err) {
    console.error(`Email delivery failed for ${teacherEmail}:`, err.message);
    return {
      success: false,
      assignmentId,
      courseName: assignment.courseName,
      teacherName: assignment.teacher?.name,
      teacherEmail,
      reason: err.message
    };
  }
}

/**
 * Send feedback reports to all teachers for active/closed assignments
 */
async function sendAllApprovedReports(filter = {}) {
  const query = { isActive: true, ...filter };
  const assignments = await CourseAssignment.find(query).populate('teacher department');

  const results = {
    total: assignments.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: []
  };

  for (const assignment of assignments) {
    try {
      const res = await sendReportForAssignment(assignment._id);
      if (res.success) {
        results.sent++;
      } else {
        results.skipped++;
      }
      results.details.push(res);
    } catch (err) {
      console.error(`Failed to email report for assignment ${assignment._id}:`, err.message);
      results.failed++;
      results.details.push({
        success: false,
        assignmentId: assignment._id,
        courseName: assignment.courseName,
        teacherName: assignment.teacher?.name,
        reason: err.message
      });
    }
  }

  return results;
}

module.exports = {
  sendReportForAssignment,
  sendAllApprovedReports
};
