const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const CourseAssignment = require('../models/CourseAssignment');
const CourseCatalog = require('../models/CourseCatalog');
const FeedbackConfig = require('../models/FeedbackConfig');
const Teacher = require('../models/Teacher');
const ReviewSession = require('../models/ReviewSession');
const Feedback = require('../models/Feedback');
const FeedbackLog = require('../models/FeedbackLog');
const Student = require('../models/Student');
const TeacherUser = require('../models/TeacherUser');
const Department = require('../models/Department');
const { JWT_SECRET } = require('../middleware/auth');
const { generateFeedbackExcel } = require('../services/excelReportGenerator');
const { generateFeedbackWord } = require('../services/wordReportGenerator');

function enrichAssignment(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const isDeadlinePassed = CourseAssignment.isDeadlinePassed(obj);
  const effectiveSessionOpen = CourseAssignment.isEffectiveSessionOpen(obj);
  return {
    ...obj,
    feedbackDeadline: obj.feedbackDeadline || null,
    isDeadlinePassed,
    effectiveSessionOpen
  };
}

function parseDeadlineInput(val) {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid feedback deadline date');
  }
  return d;
}

function sanitizeCourseOutcomes(courseOutcomes) {
  if (!Array.isArray(courseOutcomes)) return [];
  return courseOutcomes
    .filter(co => co && ((co.title && String(co.title).trim()) || (co.description && String(co.description).trim())))
    .map((co, idx) => {
      const coNumber = Number(co.coNumber) || idx + 1;
      const title = (co.title && String(co.title).trim()) ? String(co.title).trim() : `CO${coNumber}`;
      const description = co.description ? String(co.description).trim() : '';
      return { coNumber, title, description };
    });
}

async function syncCourseCatalogFromAssignment({ courseCode, courseName, semester, courseOutcomes }) {
  if (!courseCode || !Array.isArray(courseOutcomes) || courseOutcomes.length === 0) return;
  const trimmedCode = courseCode.trim();
  const escaped = trimmedCode.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const existing = await CourseCatalog.findOne({ courseCode: { $regex: new RegExp(`^${escaped}$`, 'i') } });
  if (existing) {
    existing.courseOutcomes = courseOutcomes;
    if (courseName && courseName.trim()) existing.courseName = courseName.trim();
    if (semester && semester.trim()) existing.semester = semester.trim();
    await existing.save();
  }
}

// Admin login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Pre-enlisted OBE Course Catalog ───

exports.getCourseCatalog = async (req, res) => {
  try {
    const count = await CourseCatalog.estimatedDocumentCount();
    if (count === 0) {
      await CourseCatalog.ensureSeeded();
    }
    const filter = {};
    if (req.query.semester) filter.semester = req.query.semester;
    const courses = await CourseCatalog.find(filter).sort({ courseCode: 1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.upsertCourseCatalogItem = async (req, res) => {
  try {
    const { courseCode, courseName, semester, credits, departmentCode, courseOutcomes } = req.body;
    if (!courseCode || !courseName) {
      return res.status(400).json({ message: 'Course Code and Course Name are required' });
    }
    const cleanCode = courseCode.trim();
    const cleanCOs = sanitizeCourseOutcomes(courseOutcomes);
    const updated = await CourseCatalog.findOneAndUpdate(
      { courseCode: cleanCode },
      {
        $set: {
          courseCode: cleanCode,
          courseName: courseName.trim(),
          semester: (semester || '').trim(),
          credits: credits !== undefined ? Number(credits) || 0 : 0,
          departmentCode: (departmentCode || 'ETE').trim(),
          courseOutcomes: cleanCOs
        }
      },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json({ message: 'Course catalog entry saved', course: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCourseCatalogItem = async (req, res) => {
  try {
    const { courseCode, courseName, semester, credits, courseOutcomes } = req.body;
    const updateFields = {};
    if (courseCode !== undefined) updateFields.courseCode = courseCode.trim();
    if (courseName !== undefined) updateFields.courseName = courseName.trim();
    if (semester !== undefined) updateFields.semester = semester.trim();
    if (credits !== undefined) updateFields.credits = Number(credits) || 0;
    if (courseOutcomes !== undefined) updateFields.courseOutcomes = sanitizeCourseOutcomes(courseOutcomes);

    const updated = await CourseCatalog.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Catalog course not found' });
    }

    // Sync COs to active assignments sharing this courseCode if COs were updated
    if (updateFields.courseOutcomes) {
      const escaped = updated.courseCode.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      await CourseAssignment.updateMany(
        { courseCode: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { $set: { courseOutcomes: updateFields.courseOutcomes } }
      );
    }

    res.json({ message: 'Course catalog updated successfully', course: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Course Assignment CRUD ───

exports.getAssignments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.teacherDepartment) filter.teacherDepartment = req.query.teacherDepartment;
    if (req.query.series) filter.series = req.query.series;
    if (req.query.semester) filter.semester = req.query.semester;

    const assignments = await CourseAssignment.find(filter)
      .populate('department', 'name code')
      .populate('teacherDepartment', 'name code')
      .populate({
        path: 'teacher',
        select: 'name designation email department courses',
        populate: { path: 'department', select: 'name code' }
      })
      .sort({ createdAt: -1 });

    res.json(assignments.map(enrichAssignment));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const {
      courseCode,
      courseName,
      department,
      teacherDepartment,
      semester,
      series,
      teacher,
      courseOutcomes,
      feedbackDeadline
    } = req.body;

    if (!courseCode || !courseName || !department || !series || !teacher) {
      return res.status(400).json({ message: 'Course Code, Course Name, Student Department, Series, and Teacher are required' });
    }

    let parsedDeadline = null;
    try {
      parsedDeadline = parseDeadlineInput(feedbackDeadline) ?? null;
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const teacherDoc = await Teacher.findById(teacher);
    const resolvedTeacherDept = teacherDepartment || (teacherDoc ? teacherDoc.department : undefined);

    let cleanCOs = sanitizeCourseOutcomes(courseOutcomes);
    if (cleanCOs.length === 0) {
      const escaped = courseCode.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const catalogCourse = await CourseCatalog.findOne({ courseCode: { $regex: new RegExp(`^${escaped}$`, 'i') } });
      if (catalogCourse && Array.isArray(catalogCourse.courseOutcomes) && catalogCourse.courseOutcomes.length > 0) {
        cleanCOs = sanitizeCourseOutcomes(catalogCourse.courseOutcomes);
      }
    } else {
      await syncCourseCatalogFromAssignment({
        courseCode,
        courseName,
        semester,
        courseOutcomes: cleanCOs
      });
    }

    const assignment = await CourseAssignment.create({
      courseCode: courseCode.trim(),
      courseName: courseName.trim(),
      department,
      teacherDepartment: resolvedTeacherDept,
      semester: semester || '',
      series: series.trim(),
      teacher,
      courseOutcomes: cleanCOs,
      feedbackDeadline: parsedDeadline,
      isReviewSessionOpen: true
    });

    if (teacherDoc && !teacherDoc.courses.includes(courseName.trim())) {
      teacherDoc.courses.push(courseName.trim());
      await teacherDoc.save();
    }

    const populated = await CourseAssignment.findById(assignment._id)
      .populate('department', 'name code')
      .populate('teacherDepartment', 'name code')
      .populate({
        path: 'teacher',
        select: 'name designation email department courses',
        populate: { path: 'department', select: 'name code' }
      });

    res.status(201).json({
      message: 'Course assignment created successfully',
      assignment: enrichAssignment(populated)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const {
      courseCode,
      courseName,
      department,
      teacherDepartment,
      semester,
      series,
      teacher,
      isActive,
      isReviewSessionOpen,
      courseOutcomes,
      feedbackDeadline
    } = req.body;

    const updateFields = {};
    if (courseCode) updateFields.courseCode = courseCode.trim();
    if (courseName) updateFields.courseName = courseName.trim();
    if (department) updateFields.department = department;
    if (teacherDepartment !== undefined) updateFields.teacherDepartment = teacherDepartment;
    if (semester !== undefined) updateFields.semester = semester;
    if (series) updateFields.series = series.trim();
    if (teacher) updateFields.teacher = teacher;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (isReviewSessionOpen !== undefined) updateFields.isReviewSessionOpen = Boolean(isReviewSessionOpen);

    if (courseOutcomes !== undefined) {
      updateFields.courseOutcomes = sanitizeCourseOutcomes(courseOutcomes);
    }

    if (feedbackDeadline !== undefined) {
      try {
        const parsedDeadline = parseDeadlineInput(feedbackDeadline);
        updateFields.feedbackDeadline = parsedDeadline;
        if (parsedDeadline && parsedDeadline.getTime() > Date.now() && isReviewSessionOpen === undefined) {
          updateFields.isReviewSessionOpen = true;
        }
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    const updated = await CourseAssignment.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    )
      .populate('department', 'name code')
      .populate('teacherDepartment', 'name code')
      .populate({
        path: 'teacher',
        select: 'name designation email department courses',
        populate: { path: 'department', select: 'name code' }
      });

    if (!updated) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (updateFields.courseOutcomes && updateFields.courseOutcomes.length > 0) {
      await syncCourseCatalogFromAssignment({
        courseCode: updated.courseCode,
        courseName: updated.courseName,
        semester: updated.semester,
        courseOutcomes: updateFields.courseOutcomes
      });
    }

    const targetTeacherId = teacher || updated.teacher?._id;
    const targetCourseName = (courseName || updated.courseName || '').trim();
    if (targetCourseName && targetTeacherId) {
      const teacherDoc = await Teacher.findById(targetTeacherId);
      if (teacherDoc && !teacherDoc.courses.includes(targetCourseName)) {
        teacherDoc.courses.push(targetCourseName);
        await teacherDoc.save();
      }
    }

    res.json({
      message: 'Course assignment updated successfully',
      assignment: enrichAssignment(updated)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAssignmentDeadline = async (req, res) => {
  try {
    let parsedDeadline;
    try {
      parsedDeadline = parseDeadlineInput(req.body.feedbackDeadline);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
    if (parsedDeadline === undefined) {
      return res.status(400).json({ message: 'feedbackDeadline field is required' });
    }

    const assignment = await CourseAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    assignment.feedbackDeadline = parsedDeadline;
    if (parsedDeadline && parsedDeadline.getTime() > Date.now()) {
      assignment.isReviewSessionOpen = true;
    }
    await assignment.save();

    const populated = await CourseAssignment.findById(assignment._id)
      .populate('department', 'name code')
      .populate('teacherDepartment', 'name code')
      .populate({
        path: 'teacher',
        select: 'name designation email department courses',
        populate: { path: 'department', select: 'name code' }
      });

    res.json({
      message: parsedDeadline
        ? 'Feedback deadline updated successfully'
        : 'Feedback deadline cleared',
      assignment: enrichAssignment(populated)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const deleted = await CourseAssignment.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.json({ message: 'Course assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current review session status
exports.getReviewSession = async (req, res) => {
  try {
    const session = await ReviewSession.getCurrentSession();
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle or update review session
exports.toggleReviewSession = async (req, res) => {
  try {
    const session = await ReviewSession.getCurrentSession();
    const { isOpen, sessionName, startDate, endDate, message, closedMessage } = req.body;

    if (isOpen !== undefined) session.isOpen = Boolean(isOpen);
    if (sessionName !== undefined) session.sessionName = sessionName;
    if (startDate !== undefined) session.startDate = startDate;
    if (endDate !== undefined) session.endDate = endDate;
    if (message !== undefined) session.message = message;
    if (closedMessage !== undefined) session.closedMessage = closedMessage;

    await session.save();
    res.json({ message: `Review session is now ${session.isOpen ? 'OPEN' : 'CLOSED'}`, session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change Admin Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const admin = await Admin.findById(req.admin?.id || req.user?.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle review session per course assignment
exports.toggleAssignmentSession = async (req, res) => {
  try {
    const { isReviewSessionOpen } = req.body;
    const assignment = await CourseAssignment.findByIdAndUpdate(
      req.params.id,
      { isReviewSessionOpen: Boolean(isReviewSessionOpen) },
      { new: true }
    )
      .populate('department', 'name code')
      .populate('teacherDepartment', 'name code')
      .populate({
        path: 'teacher',
        select: 'name designation email department courses',
        populate: { path: 'department', select: 'name code' }
      });

    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    res.json(enrichAssignment(assignment));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get feedback status for a specific course assignment
exports.getAssignmentStatus = async (req, res) => {
  try {
    const assignment = await CourseAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const filter = {};
    if (assignment.series !== 'all' && assignment.series !== '*') {
      filter.roll = new RegExp(`^${assignment.series}`);
    }
    if (assignment.department) {
      filter.department = assignment.department;
    }

    const students = await Student.find(filter).select('name roll');
    const logs = await FeedbackLog.find({ assignment: assignment._id }).select('student');
    const submittedStudentIds = new Set(logs.map(log => log.student.toString()));

    const statusList = students.map(s => ({
      name: s.name,
      roll: s.roll,
      hasSubmitted: submittedStudentIds.has(s._id.toString())
    }));

    statusList.sort((a, b) => a.roll.localeCompare(b.roll));

    res.json(statusList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  Admin Dynamic Feedback Questions Configuration
// ══════════════════════════════════════════════════════════════
function sanitizeSectionConfig(sec, defaultId, defaultTitle, defaultScale = 'likert') {
  const id = (sec?.id && String(sec.id).trim()) || defaultId;
  const title = (sec?.title && String(sec.title).trim()) || defaultTitle;
  const scaleType = sec?.scaleType === 'rating' ? 'rating' : (sec?.scaleType === 'likert' ? 'likert' : defaultScale);
  const rawQs = Array.isArray(sec?.questions) ? sec.questions : [];
  const usedIds = new Set();

  const questions = rawQs
    .filter(q => q && String(q.text || '').trim())
    .map((q, idx) => {
      let qId = (q.id && String(q.id).trim()) || `${id}_q${idx + 1}`;
      while (usedIds.has(qId)) {
        qId = `${qId}_${idx + 1}`;
      }
      usedIds.add(qId);
      return {
        id: qId,
        text: String(q.text).trim()
      };
    });

  return { id, title, scaleType, questions };
}

exports.getFeedbackQuestionsAdmin = async (req, res) => {
  try {
    const config = await FeedbackConfig.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateFeedbackQuestions = async (req, res) => {
  try {
    const body = req.body || {};
    const defaults = FeedbackConfig.getDefaultPayload();

    const courseContent = sanitizeSectionConfig(
      body.courseContent || defaults.courseContent,
      'courseContent',
      'Course Content and Organization',
      'likert'
    );
    const coSection = sanitizeSectionConfig(
      body.coSection || defaults.coSection,
      'coSection',
      'Course Outcomes (COs)',
      'likert'
    );
    const facilities = sanitizeSectionConfig(
      body.facilities || defaults.facilities,
      'facilities',
      'Academic and Laboratory Facilities',
      'likert'
    );
    const courseTeacher = sanitizeSectionConfig(
      body.courseTeacher || defaults.courseTeacher,
      'courseTeacher',
      'Course Teacher',
      'rating'
    );

    const customSections = (Array.isArray(body.customSections) ? body.customSections : [])
      .map((sec, idx) => sanitizeSectionConfig(sec, `custom_${idx + 1}`, `Custom Section ${idx + 1}`, 'likert'))
      .filter(sec => sec.questions.length > 0 || sec.title);

    const totalQuestions =
      courseContent.questions.length +
      coSection.questions.length +
      facilities.questions.length +
      courseTeacher.questions.length +
      customSections.reduce((sum, s) => sum + s.questions.length, 0);

    if (totalQuestions === 0) {
      return res.status(400).json({ message: 'At least one feedback question must remain across the form.' });
    }

    const updated = await FeedbackConfig.findOneAndUpdate(
      { key: 'default' },
      {
        $set: {
          key: 'default',
          courseContent,
          coSection,
          facilities,
          courseTeacher,
          customSections
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      message: 'Feedback questions updated successfully! Database, Excel, and Word reports are now synced.',
      config: updated
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resetFeedbackQuestions = async (req, res) => {
  try {
    const defaults = FeedbackConfig.getDefaultPayload();
    const updated = await FeedbackConfig.findOneAndUpdate(
      { key: 'default' },
      { $set: defaults },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({
      message: 'Feedback questions restored to default configuration',
      config: updated
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  Export assignment & teacher feedback to Excel (.xlsx) & Word (.docx)
// ══════════════════════════════════════════════════════════════
exports.exportAssignmentExcel = async (req, res) => {
  try {
    const assignment = await CourseAssignment.findById(req.params.id).populate('teacher department');
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const fbFilter = { courseName: assignment.courseName };
    if (assignment.teacher?._id) fbFilter.teacher = assignment.teacher._id;

    const feedbacks = await Feedback.find(fbFilter)
      .populate('department', 'name code')
      .sort({ createdAt: 1 });

    const buffer = await generateFeedbackExcel({ assignment, feedbacks });
    const filename = `Feedback_Report_${assignment.courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Failed to export feedback Excel report' });
  }
};

exports.exportAssignmentWord = async (req, res) => {
  try {
    const assignment = await CourseAssignment.findById(req.params.id).populate('teacher department');
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const fbFilter = { courseName: assignment.courseName };
    if (assignment.teacher?._id) fbFilter.teacher = assignment.teacher._id;

    const feedbacks = await Feedback.find(fbFilter)
      .populate('department', 'name code')
      .sort({ createdAt: 1 });

    const buffer = await generateFeedbackWord({ assignment, feedbacks });
    const filename = `Final_Feedback_${assignment.courseName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Word export error:', error);
    res.status(500).json({ message: 'Failed to export feedback Word report' });
  }
};

async function buildTeacherReportContext(teacherId, courseNameQuery) {
  const teacher = await Teacher.findById(teacherId).populate('department', 'name code');
  if (!teacher) return null;

  const fbFilter = { teacher: teacher._id };
  if (courseNameQuery) fbFilter.courseName = courseNameQuery;

  const feedbacks = await Feedback.find(fbFilter)
    .populate('department', 'name code')
    .sort({ createdAt: 1 });

  const assignFilter = { teacher: teacher._id };
  if (courseNameQuery) assignFilter.courseName = courseNameQuery;
  const assignments = await CourseAssignment.find(assignFilter)
    .populate('department', 'name code')
    .sort({ isActive: -1, createdAt: -1 });

  const uniq = (arr) => [...new Set(arr.map(v => (v || '').trim()).filter(Boolean))];
  const courseNames = uniq([
    ...assignments.map(a => a.courseName),
    ...feedbacks.map(f => f.courseName),
    ...(Array.isArray(teacher.courses) ? teacher.courses : []),
  ]);
  const courseCodes = uniq(assignments.map(a => a.courseCode));
  const semesters = uniq(assignments.map(a => a.semester));
  const seriesList = uniq(assignments.map(a => a.series));

  let courseOutcomes = [];
  const primaryAssignWithCOs = assignments.find(a =>
    a.courseOutcomes?.length > 0 && feedbacks.some(f => f.courseName === a.courseName)
  ) || assignments.find(a => a.courseOutcomes?.length > 0);

  if (primaryAssignWithCOs) {
    courseOutcomes = primaryAssignWithCOs.courseOutcomes;
  } else {
    const coMap = new Map();
    feedbacks.forEach(f => {
      (f.coFeedback || []).forEach(c => {
        if (c.coNumber && !coMap.has(c.coNumber)) {
          coMap.set(c.coNumber, {
            coNumber: c.coNumber,
            title: c.coTitle || `CO${c.coNumber}`,
            description: c.coDescription || '',
          });
        }
      });
    });
    courseOutcomes = Array.from(coMap.values()).sort((a, b) => a.coNumber - b.coNumber);
  }

  const assignment = {
    courseName: courseNames.join(' / ') || 'Course Feedback',
    courseCode: courseCodes.join(', '),
    semester: semesters.join(', ') || 'N/A',
    series: seriesList.join(', ') || 'All',
    courseOutcomes,
    teacher: {
      name: teacher.name,
      designation: teacher.designation || '',
    },
    department: teacher.department || assignments[0]?.department || feedbacks[0]?.department || { name: 'Electronics and Telecommunication Engineering', code: 'ETE' },
  };

  return { teacher, assignment, feedbacks };
}

exports.exportTeacherExcel = async (req, res) => {
  try {
    const ctx = await buildTeacherReportContext(req.params.id, req.query.courseName);
    if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

    const buffer = await generateFeedbackExcel({ assignment: ctx.assignment, feedbacks: ctx.feedbacks });
    const safeName = ctx.teacher.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Feedback_Report_${safeName}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Teacher Excel export error:', error);
    res.status(500).json({ message: 'Failed to export teacher Excel report' });
  }
};

exports.exportTeacherWord = async (req, res) => {
  try {
    const ctx = await buildTeacherReportContext(req.params.id, req.query.courseName);
    if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

    const buffer = await generateFeedbackWord({ assignment: ctx.assignment, feedbacks: ctx.feedbacks });
    const safeName = ctx.teacher.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Final_Feedback_${safeName}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Teacher Word export error:', error);
    res.status(500).json({ message: 'Failed to export teacher Word report' });
  }
};

// ══════════════════════════════════════════════════════════════
//  Email XLSX reports to teachers
// ══════════════════════════════════════════════════════════════
const { sendReportForAssignment, sendAllApprovedReports } = require('../services/autoEmailService');

exports.sendAssignmentReportEmail = async (req, res) => {
  try {
    const result = await sendReportForAssignment(req.params.id);
    if (!result.success) {
      return res.status(400).json({ message: result.reason || 'Failed to email report to teacher' });
    }
    res.json({ message: `Feedback report successfully sent to ${result.teacherEmail}`, result });
  } catch (error) {
    console.error('Email report error:', error);
    res.status(500).json({ message: error.message || 'Failed to send report' });
  }
};

exports.sendBulkReportsEmail = async (req, res) => {
  try {
    const results = await sendAllApprovedReports();
    res.json({
      message: `Reports emailed to faculty: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error('Bulk email report error:', error);
    res.status(500).json({ message: error.message || 'Failed to send bulk reports' });
  }
};

// ══════════════════════════════════════════════════════════════
//  Teacher Registration Approval Management (Admin Only)
// ══════════════════════════════════════════════════════════════
exports.getPendingTeachers = async (req, res) => {
  try {
    const pendingList = await TeacherUser.find({
      $or: [
        { isApproved: false },
        { isVerified: false, teacher: { $exists: false } },
        { isVerified: false, teacher: null }
      ]
    })
      .populate('department', 'name code')
      .sort({ createdAt: -1 });

    res.json(pendingList);
  } catch (error) {
    console.error('Get pending teachers error:', error);
    res.status(500).json({ message: 'Failed to fetch pending teacher registrations' });
  }
};

exports.approvePendingTeacher = async (req, res) => {
  try {
    const teacherUser = await TeacherUser.findById(req.params.id).populate('department');
    if (!teacherUser) {
      return res.status(404).json({ message: 'Pending teacher registration not found' });
    }

    const cleanEmail = teacherUser.email.trim().toLowerCase();

    let teacherDoc = await Teacher.findOne({ email: cleanEmail });
    if (!teacherDoc && teacherUser.department) {
      teacherDoc = await Teacher.findOne({
        name: { $regex: new RegExp(`^${teacherUser.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
        department: teacherUser.department._id
      });
    }

    if (!teacherDoc) {
      let deptId = teacherUser.department?._id;
      if (!deptId) {
        const defaultDept = await Department.findOne({});
        deptId = defaultDept?._id;
      }

      teacherDoc = await Teacher.create({
        name: teacherUser.name,
        designation: teacherUser.designation || 'Lecturer',
        department: deptId,
        email: cleanEmail,
        courses: []
      });
    } else {
      teacherDoc.email = cleanEmail;
      if (teacherUser.designation) teacherDoc.designation = teacherUser.designation;
      await teacherDoc.save();
    }

    teacherUser.teacher = teacherDoc._id;
    teacherUser.isApproved = true;
    teacherUser.isVerified = true;
    await teacherUser.save();

    const populatedTeacher = await Teacher.findById(teacherDoc._id).populate('department', 'name code');

    res.json({
      message: `Faculty member "${teacherDoc.name}" (${cleanEmail}) has been approved and added to the main server faculty directory!`,
      teacher: populatedTeacher,
      teacherUser
    });
  } catch (error) {
    console.error('Approve teacher error:', error);
    res.status(500).json({ message: error.message || 'Failed to approve teacher registration' });
  }
};

exports.rejectPendingTeacher = async (req, res) => {
  try {
    const teacherUser = await TeacherUser.findById(req.params.id);
    if (!teacherUser) {
      return res.status(404).json({ message: 'Pending teacher registration not found' });
    }

    const teacherName = teacherUser.name;
    const teacherEmail = teacherUser.email;
    await TeacherUser.findByIdAndDelete(req.params.id);

    res.json({
      message: `Registration for "${teacherName}" (${teacherEmail}) has been rejected and removed.`
    });
  } catch (error) {
    console.error('Reject teacher error:', error);
    res.status(500).json({ message: error.message || 'Failed to reject teacher registration' });
  }
};

exports.resetTestData = async (req, res) => {
  try {
    const studentResult = await Student.deleteMany({});
    const feedbackResult = await Feedback.deleteMany({});
    const logResult = await FeedbackLog.deleteMany({});

    const teacherResult = await Teacher.updateMany({}, {
      $set: {
        totalFeedbacks: 0,
        avgRating: 0,
        avgCourseContent: 0,
        avgTeachingLearning: 0,
        avgFacilities: 0,
        avgCOAttainment: 0,
        avgCourseTeacher: 0
      }
    });

    res.json({
      success: true,
      message: 'All test student profiles, feedbacks, and submission logs have been cleared. All teacher ratings have been reset to 0.',
      deletedStudents: studentResult.deletedCount,
      deletedFeedbacks: feedbackResult.deletedCount,
      deletedFeedbackLogs: logResult.deletedCount,
      teachersReset: teacherResult.modifiedCount
    });
  } catch (error) {
    console.error('Reset test data error:', error);
    res.status(500).json({ message: error.message || 'Failed to reset test data' });
  }
};
