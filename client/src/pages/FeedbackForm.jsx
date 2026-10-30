import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, User, CheckCircle2, Clock, ShieldAlert,
  Shield, ChevronRight, ChevronLeft, Send, Sparkles, Book, Target, FlaskConical, Layers
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LikertScale from '../components/LikertScale';
import './FeedbackForm.css';

const DEFAULT_QUESTION_CONFIG = {
  courseContent: {
    id: 'courseContent',
    title: 'Course Content and Organization',
    scaleType: 'likert',
    questions: [
      { id: 'cc_q1', text: 'The course contents are up-to-date and well organized' }
    ]
  },
  coSection: {
    id: 'coSection',
    title: 'Course Outcomes (COs)',
    scaleType: 'likert',
    questions: [
      { id: 'co_q1', text: 'The course contents are aligned with {CO}' },
      { id: 'co_q2', text: 'The teaching-learning methods are effective to achieve {CO}' },
      { id: 'co_q3', text: 'The used assessment tools are appropriate for {CO}' }
    ]
  },
  facilities: {
    id: 'facilities',
    title: 'Academic and Laboratory Facilities',
    scaleType: 'likert',
    questions: [
      { id: 'fac_q1', text: 'Infrastructure and academic facilities are adequate to achieve the COs' }
    ]
  },
  courseTeacher: {
    id: 'courseTeacher',
    title: 'Course Teacher',
    scaleType: 'rating',
    questions: [
      { id: 'ct_q1', text: 'Evaluate the course teacher based on class preparation, lecture delivery, and way of teaching' }
    ]
  },
  customSections: []
};

function resolveCOQuestionText(templateText, coNum) {
  const raw = String(templateText || '').trim();
  if (!raw) return `Evaluation of CO${coNum}`;
  if (/\{co\}/i.test(raw)) {
    return raw.replace(/\{co\}/gi, `CO${coNum}`);
  }
  if (/\bthis\s+CO\b/i.test(raw)) {
    return raw.replace(/\bthis\s+CO\b/gi, `CO${coNum}`);
  }
  return `${raw} (CO${coNum})`;
}

function formatDeadlineDisplay(deadlineValue) {
  if (!deadlineValue) return null;
  const d = new Date(deadlineValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function FeedbackForm() {
  const { isStudent, student } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [questionConfig, setQuestionConfig] = useState(DEFAULT_QUESTION_CONFIG);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const formRef = useRef(null);

  const [metaForm, setMetaForm] = useState({
    department: '',
    teacher: '',
    courseName: ''
  });

  const [scoresBySection, setScoresBySection] = useState({
    courseContent: {},
    co: {},
    facilities: {},
    courseTeacher: {},
    custom: {}
  });

  const [commentsBySection, setCommentsBySection] = useState({
    courseContent: '',
    co: {},
    facilities: '',
    courseTeacher: '',
    custom: {}
  });

  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [selectedTeacherName, setSelectedTeacherName] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api.get('/departments')
      .then(res => setDepartments(res.data || []))
      .catch(() => console.warn('Failed to load departments'));

    api.get('/feedback/questions')
      .then(res => {
        if (res.data && res.data.courseContent) {
          setQuestionConfig(res.data);
        }
      })
      .catch(() => console.warn('Using default feedback questions'));
  }, []);

  const isAssignmentClosed = (a) => {
    if (!a) return false;
    const dlPassed = Boolean(a.isDeadlinePassed) ||
      (a.feedbackDeadline && new Date(a.feedbackDeadline).getTime() <= nowMs);
    return a.isReviewSessionOpen === false || dlPassed;
  };

  const isAssignmentExpired = (a) => {
    if (!a) return false;
    return Boolean(a.isDeadlinePassed) ||
      Boolean(a.feedbackDeadline && new Date(a.feedbackDeadline).getTime() <= nowMs);
  };

  // Derive COs from the selected assignment
  const courseOutcomes = useMemo(() => {
    return selectedAssignment?.courseOutcomes || [];
  }, [selectedAssignment]);

  // Build dynamic STEPS based on Admin-configured questions and assignment COs
  const STEPS = useMemo(() => {
    const list = [];
    let qCounter = 1;

    list.push({
      key: 'select',
      type: 'select',
      label: 'Select',
      icon: Building2,
      questions: [],
      startQNum: 1
    });

    const ccQuestions = (questionConfig?.courseContent?.questions || []).filter(q => q?.text?.trim());
    if (ccQuestions.length > 0) {
      list.push({
        key: 'courseContent',
        type: 'courseContent',
        label: 'Content',
        title: questionConfig.courseContent.title || 'Course Content and Organization',
        scaleType: questionConfig.courseContent.scaleType || 'likert',
        icon: Book,
        questions: ccQuestions,
        startQNum: qCounter
      });
      qCounter += ccQuestions.length;
    }

    const coQuestions = (questionConfig?.coSection?.questions || []).filter(q => q?.text?.trim());
    if (coQuestions.length > 0 && courseOutcomes.length > 0) {
      courseOutcomes.forEach((co, i) => {
        const coNum = co.coNumber || (i + 1);
        list.push({
          key: `co-${coNum}-${i}`,
          type: 'co',
          coIndex: i,
          coNum,
          co,
          label: `CO${coNum}`,
          scaleType: questionConfig.coSection.scaleType || 'likert',
          icon: Target,
          questions: coQuestions,
          startQNum: qCounter
        });
        qCounter += coQuestions.length;
      });
    }

    const facQuestions = (questionConfig?.facilities?.questions || []).filter(q => q?.text?.trim());
    if (facQuestions.length > 0) {
      list.push({
        key: 'facilities',
        type: 'facilities',
        label: 'Facilities',
        title: questionConfig.facilities.title || 'Academic and Laboratory Facilities',
        scaleType: questionConfig.facilities.scaleType || 'likert',
        icon: FlaskConical,
        questions: facQuestions,
        startQNum: qCounter
      });
      qCounter += facQuestions.length;
    }

    const ctQuestions = (questionConfig?.courseTeacher?.questions || []).filter(q => q?.text?.trim());
    if (ctQuestions.length > 0) {
      list.push({
        key: 'teacher',
        type: 'teacher',
        label: 'Teacher',
        title: questionConfig.courseTeacher.title || 'Course Teacher',
        scaleType: questionConfig.courseTeacher.scaleType || 'rating',
        icon: User,
        questions: ctQuestions,
        startQNum: qCounter
      });
      qCounter += ctQuestions.length;
    }

    (questionConfig?.customSections || []).forEach((sec, idx) => {
      const qs = (sec?.questions || []).filter(q => q?.text?.trim());
      if (qs.length > 0) {
        const words = (sec.title || `Section ${idx + 1}`).trim().split(/\s+/);
        const shortLabel = words.slice(0, 2).join(' ');
        list.push({
          key: `custom-${sec.id || idx}`,
          type: 'custom',
          sectionId: sec.id || `custom_${idx + 1}`,
          label: shortLabel.length > 14 ? `${shortLabel.slice(0, 12)}…` : shortLabel,
          title: sec.title || `Additional Section ${idx + 1}`,
          scaleType: sec.scaleType || 'likert',
          icon: Layers,
          questions: qs,
          startQNum: qCounter
        });
        qCounter += qs.length;
      }
    });

    list.push({
      key: 'submit',
      type: 'submit',
      label: 'Submit',
      icon: Send,
      questions: [],
      startQNum: qCounter
    });

    return list;
  }, [questionConfig, courseOutcomes]);

  useEffect(() => {
    if (isStudent) {
      api.get('/feedback/my-assignments')
        .then(res => {
          const assignments = res.data || [];
          setMyAssignments(assignments);

          if (location.state?.assignmentId) {
            const target = assignments.find(a => a._id === location.state.assignmentId);
            if (target && !target.alreadyReviewed) {
              const expired = Boolean(target.isDeadlinePassed) ||
                Boolean(target.feedbackDeadline && new Date(target.feedbackDeadline).getTime() <= Date.now());
              const closed = target.isReviewSessionOpen === false || expired;
              const teacherId = typeof target.teacher === 'object' ? target.teacher?._id : target.teacher;
              const deptId = target.department?._id || target.department;

              if (closed) {
                setMetaForm(f => ({ ...f, department: deptId || '', teacher: teacherId || '', courseName: '' }));
                setSelectedDeptName(target.department?.name || '');
                setSelectedTeacherName(target.teacher?.name || '');
                setSelectedAssignment(null);
              } else {
                setMetaForm({
                  department: deptId || '',
                  teacher: teacherId || '',
                  courseName: target.courseName || ''
                });
                setSelectedDeptName(target.department?.name || '');
                setSelectedTeacherName(target.teacher?.name || '');
                setSelectedAssignment(target);
              }
            }
          } else if (assignments.length > 0) {
            const studentDeptId = typeof student?.department === 'object' ? student.department._id : student?.department;
            const matchingAssignment = assignments.find(a => (a.department?._id || a.department) === studentDeptId);
            const targetAssignment = matchingAssignment || assignments[0];
            const deptObj = targetAssignment.department;
            const deptId = deptObj?._id || deptObj;
            const deptName = deptObj?.name || '';
            setMetaForm(f => ({ ...f, department: deptId || '' }));
            if (deptName) setSelectedDeptName(deptName);
          } else if (student?.department) {
            const studentDeptId = typeof student.department === 'object' ? student.department._id : student.department;
            const studentDeptName = typeof student.department === 'object' ? student.department.name : '';
            setMetaForm(f => ({ ...f, department: studentDeptId || '' }));
            if (studentDeptName) setSelectedDeptName(studentDeptName);
          }
        })
        .catch(() => console.warn('Failed to load assigned courses'));
    }
  }, [isStudent, student, location.state]);

  const resetSectionAnswers = () => {
    setScoresBySection({
      courseContent: {},
      co: {},
      facilities: {},
      courseTeacher: {},
      custom: {}
    });
    setCommentsBySection({
      courseContent: '',
      co: {},
      facilities: '',
      courseTeacher: '',
      custom: {}
    });
  };

  const handleDeptChange = (e) => {
    const val = e.target.value;
    setMetaForm({ department: val, teacher: '', courseName: '' });
    const dept = departments.find(d => d._id === val);
    setSelectedDeptName(dept ? dept.name : '');
    setSelectedTeacherName('');
    setSelectedAssignment(null);
    resetSectionAnswers();
  };

  const handleTeacherChange = (e) => {
    const val = e.target.value;
    setMetaForm(f => ({ ...f, teacher: val, courseName: '' }));
    const assignment = myAssignments.find(a => {
      const teacherId = typeof a.teacher === 'object' ? a.teacher?._id : a.teacher;
      return teacherId === val;
    });
    const t = assignment?.teacher;
    setSelectedTeacherName(t ? t.name : '');
    setSelectedAssignment(null);
    resetSectionAnswers();
  };

  const handleCourseChange = (e) => {
    const courseName = e.target.value;
    const assignment = myAssignments.find(a => {
      const teacherId = typeof a.teacher === 'object' ? a.teacher?._id : a.teacher;
      return a.courseName === courseName && teacherId === metaForm.teacher && (a.department?._id || a.department) === metaForm.department;
    });
    setMetaForm(f => ({ ...f, courseName }));
    setSelectedAssignment(assignment || null);
    resetSectionAnswers();
  };

  const scrollToTop = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const safeStep = Math.min(step, STEPS.length - 1);
  const currentStep = STEPS[safeStep] || STEPS[0];

  const handleNextStep = () => {
    setStep(Math.min(safeStep + 1, STEPS.length - 1));
    scrollToTop();
  };

  const handlePrevStep = () => {
    setStep(Math.max(safeStep - 1, 0));
    scrollToTop();
  };

  const setQuestionScore = (sectionType, questionId, value, subKey = null) => {
    setScoresBySection(prev => {
      if (sectionType === 'co') {
        return {
          ...prev,
          co: {
            ...prev.co,
            [subKey]: {
              ...(prev.co[subKey] || {}),
              [questionId]: value
            }
          }
        };
      }
      if (sectionType === 'custom') {
        return {
          ...prev,
          custom: {
            ...prev.custom,
            [subKey]: {
              ...(prev.custom[subKey] || {}),
              [questionId]: value
            }
          }
        };
      }
      return {
        ...prev,
        [sectionType]: {
          ...(prev[sectionType] || {}),
          [questionId]: value
        }
      };
    });
  };

  const setSectionComment = (sectionType, value, subKey = null) => {
    setCommentsBySection(prev => {
      if (sectionType === 'co') {
        return {
          ...prev,
          co: {
            ...prev.co,
            [subKey]: value
          }
        };
      }
      if (sectionType === 'custom') {
        return {
          ...prev,
          custom: {
            ...prev.custom,
            [subKey]: value
          }
        };
      }
      return {
        ...prev,
        [sectionType]: value
      };
    });
  };

  const isStepComplete = (stepItem) => {
    if (!stepItem) return false;
    if (stepItem.type === 'select') {
      if (!metaForm.courseName.trim()) return false;
      if (selectedAssignment && isAssignmentClosed(selectedAssignment)) return false;
      return true;
    }
    if (stepItem.type === 'courseContent') {
      return stepItem.questions.every(q => Number(scoresBySection.courseContent[q.id]) >= 1);
    }
    if (stepItem.type === 'co') {
      const coScores = scoresBySection.co[stepItem.coIndex] || {};
      return stepItem.questions.every(q => Number(coScores[q.id]) >= 1);
    }
    if (stepItem.type === 'facilities') {
      return stepItem.questions.every(q => Number(scoresBySection.facilities[q.id]) >= 1);
    }
    if (stepItem.type === 'teacher') {
      return stepItem.questions.every(q => Number(scoresBySection.courseTeacher[q.id]) >= 1);
    }
    if (stepItem.type === 'custom') {
      const secScores = scoresBySection.custom[stepItem.sectionId] || {};
      return stepItem.questions.every(q => Number(secScores[q.id]) >= 1);
    }
    if (stepItem.type === 'submit') {
      return STEPS.filter(s => s.type !== 'submit').every(s => isStepComplete(s));
    }
    return true;
  };

  const canNext = () => isStepComplete(currentStep);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const matchedAssignment = selectedAssignment || myAssignments.find(a =>
        a.courseName === metaForm.courseName &&
        (typeof a.teacher === 'object' ? a.teacher._id === metaForm.teacher : a.teacher === metaForm.teacher) &&
        (a.department?._id || a.department) === metaForm.department
      );

      if (matchedAssignment && isAssignmentExpired(matchedAssignment)) {
        toast.error('The feedback deadline for this course has passed. The review session is closed.');
        setLoading(false);
        return;
      }

      const ccQuestions = (questionConfig?.courseContent?.questions || []).filter(q => q?.text?.trim());
      const ccResponses = ccQuestions.map(q => ({
        questionId: q.id,
        questionText: q.text.trim(),
        score: Number(scoresBySection.courseContent[q.id])
      }));

      const coQuestions = (questionConfig?.coSection?.questions || []).filter(q => q?.text?.trim());
      const coPayload = courseOutcomes.map((co, i) => {
        const coNum = co.coNumber || (i + 1);
        const coScores = scoresBySection.co[i] || {};
        const responses = coQuestions.map(q => ({
          questionId: q.id,
          questionText: resolveCOQuestionText(q.text, coNum),
          score: Number(coScores[q.id])
        }));
        return {
          coNumber: coNum,
          coTitle: co.title || '',
          coDescription: co.description || '',
          responses,
          ...(responses[0] ? { q1_contentAligned: responses[0].score } : {}),
          ...(responses[1] ? { q2_methodsEffective: responses[1].score } : {}),
          ...(responses[2] ? { q3_assessmentAppropriate: responses[2].score } : {}),
          comment: commentsBySection.co[i] || ''
        };
      });

      const facQuestions = (questionConfig?.facilities?.questions || []).filter(q => q?.text?.trim());
      const facResponses = facQuestions.map(q => ({
        questionId: q.id,
        questionText: q.text.trim(),
        score: Number(scoresBySection.facilities[q.id])
      }));

      const ctQuestions = (questionConfig?.courseTeacher?.questions || []).filter(q => q?.text?.trim());
      const ctResponses = ctQuestions.map(q => ({
        questionId: q.id,
        questionText: q.text.trim(),
        score: Number(scoresBySection.courseTeacher[q.id])
      }));

      const customPayload = (questionConfig?.customSections || [])
        .filter(sec => (sec?.questions || []).some(q => q?.text?.trim()))
        .map(sec => {
          const secScores = scoresBySection.custom[sec.id] || {};
          const responses = sec.questions
            .filter(q => q?.text?.trim())
            .map(q => ({
              questionId: q.id,
              questionText: q.text.trim(),
              score: Number(secScores[q.id])
            }));
          return {
            sectionId: sec.id,
            sectionTitle: sec.title,
            scaleType: sec.scaleType === 'rating' ? 'rating' : 'likert',
            responses,
            comment: commentsBySection.custom[sec.id] || ''
          };
        });

      await api.post('/feedback', {
        department: metaForm.department,
        teacher: metaForm.teacher,
        courseName: metaForm.courseName,
        assignmentId: matchedAssignment?._id,
        courseContentOrg: {
          responses: ccResponses,
          ...(ccResponses[0] ? { q1_upToDate: ccResponses[0].score } : {}),
          comment: commentsBySection.courseContent || ''
        },
        coFeedback: coPayload,
        academicFacilities: {
          responses: facResponses,
          ...(facResponses[0] ? { q1_infrastructure: facResponses[0].score } : {}),
          comment: commentsBySection.facilities || ''
        },
        courseTeacherEval: {
          responses: ctResponses,
          ...(ctResponses[0] ? { rating: ctResponses[0].score } : {}),
          comment: commentsBySection.courseTeacher || ''
        },
        customSections: customPayload
      });

      setSubmitted(true);
      scrollToTop();
      toast.success('Feedback submitted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMetaForm({ department: '', teacher: '', courseName: '' });
    resetSectionAnswers();
    setStep(0);
    setSubmitted(false);
    setSelectedDeptName('');
    setSelectedTeacherName('');
    setSelectedAssignment(null);
    scrollToTop();
  };

  if (submitted) {
    return (
      <div className="feedback-page page-transition" ref={formRef}>
        <div className="container container-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="success-card glass-card"
          >
            <div className="success-icon-wrap">
              <CheckCircle2 size={64} />
            </div>
            <h2 className="font-display success-title">Thank You!</h2>
            <p className="success-text">
              Your anonymous feedback has been submitted successfully.
              Your voice helps improve education quality in the Department of Electronics and Telecommunication Engineering.
            </p>
            <div className="success-actions">
              <button onClick={handleReset} className="btn btn-primary btn-lg">
                <Sparkles size={18} />
                Submit Another Feedback
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page page-transition" ref={formRef}>
      <div className="container container-md">
        {/* Header */}
        <div className="feedback-header">
          <div className="anonymity-badge">
            <Shield size={16} />
            <span>100% Anonymous</span>
          </div>
          <h1 className="font-display feedback-title">
            Course <span className="text-gradient">Feedback</span>
          </h1>
          <p className="feedback-subtitle">
            Your honest and constructive feedback is valuable for improving teaching quality.
          </p>
        </div>

        {!isStudent ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="feedback-form-card glass-card"
            style={{ textAlign: 'center', padding: '40px 20px' }}
          >
            <Shield size={48} style={{ color: 'var(--primary-color)', margin: '0 auto 20px' }} />
            <h2 style={{ marginBottom: '10px' }}>Student Login Required</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
              To prevent spam and ensure the integrity of the feedback system, you must log in with your student credentials. Your feedback will remain 100% anonymous.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <a href="/student/login" className="btn btn-primary">Login as Student</a>
              <a href="/student/register" className="btn btn-outline">Register</a>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Step Indicator */}
            <div className="step-indicator">
              {STEPS.map((s, i) => (
                <div key={s.key} className={`step-dot-wrap ${i === safeStep ? 'active' : ''} ${i < safeStep ? 'completed' : ''}`}>
                  <div className="step-dot">
                    {i < safeStep ? <CheckCircle2 size={14} /> : <s.icon size={14} />}
                  </div>
                  <span className="step-dot-label">{s.label}</span>
                  {i < STEPS.length - 1 && <div className="step-line" />}
                </div>
              ))}
            </div>

            {/* Form Steps */}
            <div className="feedback-form-card glass-card">
              <AnimatePresence mode="wait">

                {/* Step 0: Select Department, Teacher, Course */}
                {currentStep.type === 'select' && (
                  <motion.div
                    key="step-select"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <Building2 size={22} className="form-step-icon" />
                      Select Department & Teacher
                    </h2>
                    <div className="form-group mt-4">
                      <label className="form-label" htmlFor="dept-select">Department</label>
                      <select
                        id="dept-select"
                        className="form-select"
                        style={{ backgroundColor: '#FFFFFF', color: '#000000', fontWeight: 500 }}
                        value={metaForm.department}
                        onChange={handleDeptChange}
                        required
                      >
                        <option value="" style={{ backgroundColor: '#FFFFFF', color: '#64748B' }}>Select Department</option>
                        {departments.map(d => (
                          <option key={d._id} value={d._id} style={{ backgroundColor: '#FFFFFF', color: '#000000' }}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group mt-4">
                      <label className="form-label" htmlFor="teacher-select">Teacher</label>
                      <select
                        id="teacher-select"
                        className="form-select"
                        style={{ backgroundColor: metaForm.department ? '#FFFFFF' : '#F1F5F9', color: metaForm.department ? '#000000' : '#64748B', fontWeight: 500 }}
                        value={metaForm.teacher}
                        onChange={handleTeacherChange}
                        disabled={!metaForm.department}
                        required
                      >
                        <option value="" style={{ backgroundColor: '#FFFFFF', color: '#64748B' }}>Select Teacher</option>
                        {Array.from(new Map(
                          myAssignments
                            .filter(a => ((a.department?._id || a.department) === metaForm.department))
                            .map(a => [typeof a.teacher === 'object' ? a.teacher._id : a.teacher, a.teacher])
                        ).values()).filter(Boolean).map(t => {
                          const deptCode = t.department?.code || t.department?.name || '';
                          return (
                            <option key={t._id || t} value={t._id || t} style={{ backgroundColor: '#FFFFFF', color: '#000000' }}>
                              {t.name} {t.designation ? `(${t.designation})` : ''} {deptCode ? `— ${deptCode}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="form-group mt-4">
                      <label className="form-label" htmlFor="course-select">Course</label>
                      <select
                        id="course-select"
                        className="form-select"
                        style={{ backgroundColor: metaForm.teacher ? '#FFFFFF' : '#F1F5F9', color: metaForm.teacher ? '#000000' : '#64748B', fontWeight: 500 }}
                        value={metaForm.courseName}
                        onChange={handleCourseChange}
                        disabled={!metaForm.teacher}
                        required
                      >
                        <option value="" style={{ backgroundColor: '#FFFFFF', color: '#64748B' }}>Select Course</option>
                        {myAssignments
                          .filter(a => {
                            const teacherId = typeof a.teacher === 'object' ? a.teacher?._id : a.teacher;
                            const deptId = a.department?._id || a.department;
                            return teacherId === metaForm.teacher && deptId === metaForm.department;
                          })
                          .filter(a => !a.alreadyReviewed)
                          .map(a => {
                            const expired = isAssignmentExpired(a);
                            const closed = isAssignmentClosed(a);
                            const dlStr = formatDeadlineDisplay(a.feedbackDeadline);
                            const statusSuffix = expired
                              ? ' (Deadline Passed — Closed)'
                              : closed
                                ? ' (Closed)'
                                : dlStr
                                  ? ` (Due: ${dlStr})`
                                  : '';
                            return (
                              <option
                                key={a._id}
                                value={a.courseName}
                                disabled={closed}
                                style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
                              >
                                {a.courseCode ? `${a.courseCode} — ` : ''}{a.courseName}{statusSuffix}
                              </option>
                            );
                          })}
                      </select>
                      {metaForm.teacher && (() => {
                        const teacherCourses = myAssignments.filter(a => {
                          const teacherId = typeof a.teacher === 'object' ? a.teacher?._id : a.teacher;
                          const deptId = a.department?._id || a.department;
                          return teacherId === metaForm.teacher && deptId === metaForm.department;
                        });
                        const unreviewedCourses = teacherCourses.filter(a => !a.alreadyReviewed);
                        if (teacherCourses.length > 0 && unreviewedCourses.length === 0) {
                          return (
                            <div style={{ marginTop: '12px', padding: '12px 16px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: 'var(--radius-md)', color: 'var(--ruet-emerald)', fontSize: '0.875rem' }}>
                              ✓ You have already submitted feedback for all assigned courses with this teacher.
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Show Deadline Banner if course selected */}
                    {selectedAssignment && (
                      <div
                        className="mt-4"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          background: isAssignmentClosed(selectedAssignment)
                            ? 'rgba(244, 63, 94, 0.1)'
                            : 'rgba(59, 130, 246, 0.08)',
                          border: `1px solid ${
                            isAssignmentClosed(selectedAssignment)
                              ? 'rgba(244, 63, 94, 0.28)'
                              : 'rgba(59, 130, 246, 0.22)'
                          }`,
                          fontSize: '0.88rem'
                        }}
                      >
                        {isAssignmentClosed(selectedAssignment) ? (
                          <>
                            <ShieldAlert size={18} style={{ color: '#F87171', flexShrink: 0 }} />
                            <span style={{ color: '#F87171', fontWeight: 500 }}>
                              {isAssignmentExpired(selectedAssignment)
                                ? `Feedback deadline passed on ${formatDeadlineDisplay(selectedAssignment.feedbackDeadline)}. Review session is closed.`
                                : 'Review session for this course is currently closed.'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock size={18} style={{ color: '#60A5FA', flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-secondary)' }}>
                              Feedback Deadline:{' '}
                              <strong style={{ color: 'var(--text-primary)' }}>
                                {formatDeadlineDisplay(selectedAssignment.feedbackDeadline) || 'Open (No deadline set)'}
                              </strong>
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Show CO info if assignment is selected */}
                    {selectedAssignment && courseOutcomes.length > 0 && (
                      <div className="co-preview mt-4" style={{
                        background: 'rgba(39, 174, 96, 0.08)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        border: '1px solid rgba(39, 174, 96, 0.2)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--ruet-emerald)' }}>
                          <Target size={16} />
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>This course has {courseOutcomes.length} Course Outcome(s)</span>
                        </div>
                        {courseOutcomes.map((co, i) => {
                          const coNum = co.coNumber || (i + 1);
                          const rawTitle = (co.title || '').trim();
                          const rawDesc = (co.description || '').trim();
                          const isGeneric = !rawTitle || rawTitle.toUpperCase() === `CO${coNum}`;
                          const text = isGeneric ? rawDesc : (rawDesc && rawDesc !== rawTitle ? `${rawTitle} — ${rawDesc}` : rawTitle);
                          return (
                            <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              <strong>CO{coNum}{text ? ':' : ''}</strong> {text}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Course Content / Facilities / Teacher / Custom Sections */}
                {(currentStep.type === 'courseContent' ||
                  currentStep.type === 'facilities' ||
                  currentStep.type === 'teacher' ||
                  currentStep.type === 'custom') && (() => {
                  const StepIcon = currentStep.icon;
                  const isNumeric = currentStep.scaleType === 'rating';
                  const sectionMapKey = currentStep.type === 'teacher' ? 'courseTeacher' : currentStep.type;
                  const currentScores = currentStep.type === 'custom'
                    ? (scoresBySection.custom[currentStep.sectionId] || {})
                    : (scoresBySection[sectionMapKey] || {});
                  const currentComment = currentStep.type === 'custom'
                    ? (commentsBySection.custom[currentStep.sectionId] || '')
                    : (commentsBySection[sectionMapKey] || '');

                  return (
                    <motion.div
                      key={currentStep.key}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="form-step"
                    >
                      <h2 className="form-step-title">
                        <StepIcon size={22} className="form-step-icon" />
                        {currentStep.title}
                      </h2>
                      <p className="form-step-desc">
                        {isNumeric
                          ? 'Rate each item from 1 (Poor) to 5 (Excellent).'
                          : 'Please indicate your level of agreement with each statement.'}
                      </p>

                      <div className="likert-section">
                        {currentStep.questions.map((q, qIdx) => (
                          <LikertScale
                            key={q.id || qIdx}
                            question={`${currentStep.startQNum + qIdx}. ${q.text}`}
                            value={currentScores[q.id] || 0}
                            onChange={(v) => setQuestionScore(sectionMapKey, q.id, v, currentStep.sectionId)}
                            variant={isNumeric ? 'numeric' : 'likert'}
                          />
                        ))}

                        <div className="form-group mt-4">
                          <label className="form-label">Any other comments:</label>
                          <textarea
                            className="form-textarea"
                            rows={3}
                            placeholder="Write any comments here (optional)..."
                            value={currentComment}
                            onChange={(e) => setSectionComment(sectionMapKey, e.target.value, currentStep.sectionId)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Dynamic CO Steps */}
                {currentStep.type === 'co' && (() => {
                  const coIndex = currentStep.coIndex;
                  const co = currentStep.co;
                  const coNum = currentStep.coNum;
                  const coScores = scoresBySection.co[coIndex] || {};
                  const coComment = commentsBySection.co[coIndex] || '';
                  const isNumeric = currentStep.scaleType === 'rating';
                  const rawTitle = (co?.title || '').trim();
                  const rawDesc = (co?.description || '').trim();
                  const isGenericTitle = !rawTitle || rawTitle.toUpperCase() === `CO${coNum}`;
                  const coStatement = isGenericTitle
                    ? rawDesc
                    : (rawDesc && rawDesc !== rawTitle ? `${rawTitle} — ${rawDesc}` : rawTitle);

                  return (
                    <motion.div
                      key={currentStep.key}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="form-step"
                    >
                      <h2 className="form-step-title">
                        <Target size={22} className="form-step-icon" style={{ color: 'var(--ruet-emerald)' }} />
                        CO{coNum}{coStatement ? `: ${coStatement}` : ''}
                      </h2>
                      <p className="form-step-desc">
                        {isNumeric
                          ? 'Rate each item from 1 (Poor) to 5 (Excellent).'
                          : 'Please indicate your level of agreement with each statement.'}
                      </p>

                      <div className="likert-section">
                        {currentStep.questions.map((q, qIdx) => (
                          <LikertScale
                            key={q.id || qIdx}
                            question={`${currentStep.startQNum + qIdx}. ${resolveCOQuestionText(q.text, coNum)}`}
                            value={coScores[q.id] || 0}
                            onChange={(v) => setQuestionScore('co', q.id, v, coIndex)}
                            variant={isNumeric ? 'numeric' : 'likert'}
                          />
                        ))}

                        <div className="form-group mt-4">
                          <label className="form-label">Any other comments:</label>
                          <textarea
                            className="form-textarea"
                            rows={3}
                            placeholder="Write any comments here (optional)..."
                            value={coComment}
                            onChange={(e) => setSectionComment('co', e.target.value, coIndex)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Review & Submit */}
                {currentStep.type === 'submit' && (
                  <motion.div
                    key="step-submit"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <CheckCircle2 size={22} className="form-step-icon" />
                      Review & Submit
                    </h2>

                    <div className="review-summary">
                      <div className="review-row">
                        <span className="review-label">Department</span>
                        <span className="review-value">{selectedDeptName}</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">Teacher</span>
                        <span className="review-value">{selectedTeacherName}</span>
                      </div>
                      {metaForm.courseName && (
                        <div className="review-row">
                          <span className="review-label">Course</span>
                          <span className="review-value">
                            {selectedAssignment?.courseCode ? `${selectedAssignment.courseCode} — ` : ''}
                            {metaForm.courseName}
                          </span>
                        </div>
                      )}

                      <div className="divider" style={{ margin: 'var(--sp-4) 0' }} />

                      <h4 className="review-section-title">Sections Completed</h4>

                      {STEPS.filter(s => s.type !== 'select' && s.type !== 'submit').map((s) => {
                        let label = s.title || s.label;
                        if (s.type === 'co') {
                          const rawTitle = (s.co?.title || '').trim();
                          const rawDesc = (s.co?.description || '').trim();
                          const isGeneric = !rawTitle || rawTitle.toUpperCase() === `CO${s.coNum}`;
                          const text = isGeneric ? rawDesc : rawTitle;
                          label = `CO${s.coNum}${text ? `: ${text}` : ''}`;
                        }
                        return (
                          <div className="review-row" key={s.key}>
                            <span className="review-label">{label}</span>
                            <span className="review-value" style={{ color: 'var(--ruet-emerald)' }}>✓ Completed</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="anonymity-notice mt-6">
                      <Shield size={18} />
                      <span>This feedback is completely anonymous. Your identity will never be shared with the teacher or department.</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="form-nav">
                {safeStep > 0 ? (
                  <button onClick={handlePrevStep} className="btn btn-secondary">
                    <ChevronLeft size={18} />
                    Back
                  </button>
                ) : <div />}

                <div style={{ flex: 1 }} />

                {safeStep < STEPS.length - 1 ? (
                  <button
                    onClick={handleNextStep}
                    className="btn btn-primary"
                    disabled={!canNext()}
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="btn btn-primary btn-lg"
                    disabled={loading || !canNext()}
                    id="submit-feedback"
                  >
                    {loading ? (
                      <span className="btn-loading">Submitting...</span>
                    ) : (
                      <>
                        <Send size={18} />
                        Submit Feedback
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
