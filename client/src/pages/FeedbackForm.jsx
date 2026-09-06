import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, User, Star as StarIcon, MessageSquare, CheckCircle2, 
  Shield, ChevronRight, ChevronLeft, Send, Sparkles, BookOpen, Book, Users, Presentation, Lightbulb, Frown, Target, FlaskConical
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LikertScale from '../components/LikertScale';
import './FeedbackForm.css';

export default function FeedbackForm() {
  const { isStudent } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const formRef = useRef(null);

  const [form, setForm] = useState({
    department: '',
    teacher: '',
    courseName: '',
    courseContentOrg: { q1_objectives: 0, q2_workload: 0, q3_organized: 0, comment: '' },
    coFeedback: [], // will be populated dynamically based on assignment COs
    teachingLearning: { q1_structured: 0, q2_participation: 0, q3_materials: 0, q4_assessment: 0, comment: '' },
    academicFacilities: { q1_environment: 0, q2_classrooms: 0, q3_laboratory: 0, comment: '' },
  });

  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [selectedTeacherName, setSelectedTeacherName] = useState('');

  // Derive COs from the selected assignment
  const courseOutcomes = useMemo(() => {
    return selectedAssignment?.courseOutcomes || [];
  }, [selectedAssignment]);

  // Build dynamic STEPS based on the number of COs
  const STEPS = useMemo(() => {
    const steps = [
      { label: 'Select', icon: Building2 },
      { label: 'Content', icon: Book },
    ];
    
    // Add one step per CO
    courseOutcomes.forEach((co, i) => {
      steps.push({ label: `CO${co.coNumber || (i + 1)}`, icon: Target });
    });

    steps.push({ label: 'Teaching', icon: Presentation });
    steps.push({ label: 'Facilities', icon: FlaskConical });
    steps.push({ label: 'Submit', icon: Send });

    return steps;
  }, [courseOutcomes]);

  useEffect(() => {
    api.get('/departments')
      .then(res => setDepartments(res.data))
      .catch(() => console.warn('Failed to load departments'));
  }, []);

  useEffect(() => {
    if (isStudent) {
      api.get('/feedback/my-assignments')
        .then(res => setMyAssignments(res.data || []))
        .catch(() => console.warn('Failed to load assigned courses'));
    }
  }, [isStudent]);

  const handleDeptChange = (e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, department: val, teacher: '', courseName: '' }));
    const dept = departments.find(d => d._id === val);
    setSelectedDeptName(dept ? dept.name : '');
    setSelectedAssignment(null);
  };

  const handleTeacherChange = (e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, teacher: val, courseName: '' }));
    const assignment = myAssignments.find(a => {
      const teacherId = typeof a.teacher === 'object' ? a.teacher?._id : a.teacher;
      return teacherId === val;
    });
    const t = assignment?.teacher;
    setSelectedTeacherName(t ? t.name : '');
    setSelectedAssignment(null);
  };

  const handleCourseChange = (e) => {
    const courseName = e.target.value;
    setForm(f => ({ ...f, courseName }));
    
    // Find the selected assignment to get its COs
    const assignment = myAssignments.find(a => {
      const teacherId = typeof a.teacher === 'object' ? a.teacher?._id : a.teacher;
      return a.courseName === courseName && teacherId === form.teacher && a.department?._id === form.department;
    });
    setSelectedAssignment(assignment || null);

    // Initialize coFeedback based on assignment COs
    if (assignment?.courseOutcomes?.length > 0) {
      const coFeedback = assignment.courseOutcomes.map(co => ({
        coNumber: co.coNumber,
        coTitle: co.title,
        coDescription: co.description,
        q1_achievement: 0,
        q2_alignment: 0,
        q3_assessment: 0,
        comment: ''
      }));
      setForm(f => ({ ...f, courseName, coFeedback }));
    } else {
      setForm(f => ({ ...f, courseName, coFeedback: [] }));
    }
  };

  const scrollToTop = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextStep = () => {
    setStep(s => s + 1);
    scrollToTop();
  };
  
  const handlePrevStep = () => {
    setStep(s => s - 1);
    scrollToTop();
  };

  // Determine what each step index corresponds to
  const getStepType = (stepIdx) => {
    if (stepIdx === 0) return { type: 'select' };
    if (stepIdx === 1) return { type: 'courseContent' };
    
    const coCount = courseOutcomes.length;
    if (stepIdx >= 2 && stepIdx < 2 + coCount) {
      return { type: 'co', coIndex: stepIdx - 2 };
    }
    if (stepIdx === 2 + coCount) return { type: 'teachingLearning' };
    if (stepIdx === 3 + coCount) return { type: 'facilities' };
    if (stepIdx === 4 + coCount) return { type: 'submit' };
    return { type: 'unknown' };
  };

  const canNext = () => {
    const info = getStepType(step);

    if (info.type === 'select') {
      return form.courseName.trim() !== '';
    }
    if (info.type === 'courseContent') {
      return form.courseContentOrg.q1_objectives && form.courseContentOrg.q2_workload && form.courseContentOrg.q3_organized;
    }
    if (info.type === 'co') {
      const co = form.coFeedback[info.coIndex];
      return co && co.q1_achievement && co.q2_alignment && co.q3_assessment;
    }
    if (info.type === 'teachingLearning') {
      return form.teachingLearning.q1_structured && form.teachingLearning.q2_participation && 
             form.teachingLearning.q3_materials && form.teachingLearning.q4_assessment;
    }
    if (info.type === 'facilities') {
      return form.academicFacilities.q1_environment && form.academicFacilities.q2_classrooms && form.academicFacilities.q3_laboratory;
    }
    return true;
  };

  const updateNestedForm = (section, field, value) => {
    setForm(f => ({
      ...f,
      [section]: {
        ...f[section],
        [field]: value
      }
    }));
  };

  const updateCOFeedback = (coIndex, field, value) => {
    setForm(f => {
      const updated = [...f.coFeedback];
      updated[coIndex] = { ...updated[coIndex], [field]: value };
      return { ...f, coFeedback: updated };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const matchedAssignment = myAssignments.find(a => 
        a.courseName === form.courseName && 
        (typeof a.teacher === 'object' ? a.teacher._id === form.teacher : a.teacher === form.teacher) &&
        a.department?._id === form.department
      );

      await api.post('/feedback', {
        ...form,
        assignmentId: matchedAssignment?._id
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
    setForm({
      department: '', teacher: '', courseName: '',
      courseContentOrg: { q1_objectives: 0, q2_workload: 0, q3_organized: 0, comment: '' },
      coFeedback: [],
      teachingLearning: { q1_structured: 0, q2_participation: 0, q3_materials: 0, q4_assessment: 0, comment: '' },
      academicFacilities: { q1_environment: 0, q2_classrooms: 0, q3_laboratory: 0, comment: '' },
    });
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
              Your voice helps improve education quality at RUET.
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

  const currentStepType = getStepType(step);

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
            Course & Teacher <span className="text-gradient">Evaluation</span>
          </h1>
          <p className="feedback-subtitle">
            Your honest evaluation helps teachers improve and ensures quality education.
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
              To prevent spam and ensure the integrity of the feedback system, you must log in with your RUET student credentials. Your feedback will remain 100% anonymous.
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
                <div key={i} className={`step-dot-wrap ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
                  <div className="step-dot">
                    {i < step ? <CheckCircle2 size={14} /> : <s.icon size={14} />}
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
                {currentStepType.type === 'select' && (
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
                        value={form.department} 
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
                        style={{ backgroundColor: form.department ? '#FFFFFF' : '#F1F5F9', color: form.department ? '#000000' : '#64748B', fontWeight: 500 }}
                        value={form.teacher} 
                        onChange={handleTeacherChange} 
                        disabled={!form.department} 
                        required
                      >
                        <option value="" style={{ backgroundColor: '#FFFFFF', color: '#64748B' }}>Select Teacher</option>
                        {Array.from(new Map(
                          myAssignments
                            .filter(a => a.department?._id === form.department)
                            .map(a => [typeof a.teacher === 'object' ? a.teacher._id : a.teacher, a.teacher])
                        ).values()).map(t => (
                          <option key={t._id || t} value={t._id || t} style={{ backgroundColor: '#FFFFFF', color: '#000000' }}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group mt-4">
                      <label className="form-label" htmlFor="course-select">Course</label>
                      <select 
                        id="course-select" 
                        className="form-select" 
                        style={{ backgroundColor: form.teacher ? '#FFFFFF' : '#F1F5F9', color: form.teacher ? '#000000' : '#64748B', fontWeight: 500 }}
                        value={form.courseName} 
                        onChange={handleCourseChange} 
                        disabled={!form.teacher} 
                        required
                      >
                        <option value="" style={{ backgroundColor: '#FFFFFF', color: '#64748B' }}>Select Course</option>
                        {myAssignments
                          .filter(a => {
                            const teacherId = typeof a.teacher === 'object' ? a.teacher?._id : a.teacher;
                            return teacherId === form.teacher && a.department?._id === form.department;
                          })
                          .map(a => (
                            <option key={a._id} value={a.courseName} disabled={!a.isReviewSessionOpen} style={{ backgroundColor: '#FFFFFF', color: '#000000' }}>
                              {a.courseName} {!a.isReviewSessionOpen && '(Closed)'}
                            </option>
                          ))}
                      </select>
                    </div>

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
                        {courseOutcomes.map((co, i) => (
                          <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <strong>CO{co.coNumber || (i + 1)}:</strong> {co.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 1: Course Content & Organisation */}
                {currentStepType.type === 'courseContent' && (
                  <motion.div
                    key="step-courseContent"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <Book size={22} className="form-step-icon" />
                      Course Content & Organisation
                    </h2>
                    <p className="form-step-desc">Rate the following from Strongly Disagree to Strongly Agree</p>
                    
                    <div className="likert-section">
                      <LikertScale 
                        question="1. The course objectives were clear" 
                        value={form.courseContentOrg.q1_objectives} 
                        onChange={(v) => updateNestedForm('courseContentOrg', 'q1_objectives', v)} 
                      />
                      <LikertScale 
                        question="2. The course workload was manageable" 
                        value={form.courseContentOrg.q2_workload} 
                        onChange={(v) => updateNestedForm('courseContentOrg', 'q2_workload', v)} 
                      />
                      <LikertScale 
                        question="3. The course was well organized" 
                        value={form.courseContentOrg.q3_organized} 
                        onChange={(v) => updateNestedForm('courseContentOrg', 'q3_organized', v)} 
                      />
                      
                      <div className="form-group mt-4">
                        <label className="form-label">4. Comments on Course Content & Organisation (Optional)</label>
                        <textarea className="form-textarea" rows={3} value={form.courseContentOrg.comment} onChange={(e) => updateNestedForm('courseContentOrg', 'comment', e.target.value)} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Dynamic CO Steps */}
                {currentStepType.type === 'co' && (() => {
                  const coIndex = currentStepType.coIndex;
                  const co = courseOutcomes[coIndex];
                  const coNum = co?.coNumber || (coIndex + 1);
                  const coData = form.coFeedback[coIndex] || {};

                  return (
                    <motion.div
                      key={`step-co-${coIndex}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="form-step"
                    >
                      <h2 className="form-step-title">
                        <Target size={22} className="form-step-icon" style={{ color: 'var(--ruet-emerald)' }} />
                        CO{coNum}: {co?.title}
                      </h2>
                      <p className="form-step-desc" style={{ 
                        background: 'rgba(39, 174, 96, 0.08)', 
                        padding: '12px 16px', 
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(39, 174, 96, 0.15)',
                        marginBottom: '20px'
                      }}>
                        {co?.description}
                      </p>
                      
                      <div className="likert-section">
                        <LikertScale 
                          question={`1. To what extent this course helped you to achieve this CO`}
                          value={coData.q1_achievement || 0}
                          onChange={(v) => updateCOFeedback(coIndex, 'q1_achievement', v)}
                          variant="achievement"
                        />
                        <LikertScale 
                          question={`2. Does the teaching-learning method aligned with this CO`}
                          value={coData.q2_alignment || 0}
                          onChange={(v) => updateCOFeedback(coIndex, 'q2_alignment', v)}
                        />
                        <LikertScale 
                          question={`3. Does the assessment tool used for this CO engage you in the learning process`}
                          value={coData.q3_assessment || 0}
                          onChange={(v) => updateCOFeedback(coIndex, 'q3_assessment', v)}
                        />
                        
                        <div className="form-group mt-4">
                          <label className="form-label">4. Comments or suggestions regarding this CO (Optional)</label>
                          <textarea 
                            className="form-textarea" 
                            rows={3} 
                            value={coData.comment || ''} 
                            onChange={(e) => updateCOFeedback(coIndex, 'comment', e.target.value)} 
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Teaching-Learning & Assessment */}
                {currentStepType.type === 'teachingLearning' && (
                  <motion.div
                    key="step-teachingLearning"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <Presentation size={22} className="form-step-icon" />
                      Teaching-Learning & Assessment
                    </h2>
                    <p className="form-step-desc">Rate the following from Strongly Disagree to Strongly Agree</p>
                    
                    <div className="likert-section">
                      <LikertScale 
                        question="1. I think the course was well structured to achieve the learning outcomes" 
                        value={form.teachingLearning.q1_structured} 
                        onChange={(v) => updateNestedForm('teachingLearning', 'q1_structured', v)} 
                      />
                      <LikertScale 
                        question="2. The learning and teaching methods encouraged participation" 
                        value={form.teachingLearning.q2_participation} 
                        onChange={(v) => updateNestedForm('teachingLearning', 'q2_participation', v)} 
                      />
                      <LikertScale 
                        question="3. Learning materials were relevant and useful" 
                        value={form.teachingLearning.q3_materials} 
                        onChange={(v) => updateNestedForm('teachingLearning', 'q3_materials', v)} 
                      />
                      <LikertScale 
                        question="4. Do the assessment activities encourage you to apply the knowledge and skills you have learned" 
                        value={form.teachingLearning.q4_assessment} 
                        onChange={(v) => updateNestedForm('teachingLearning', 'q4_assessment', v)} 
                      />
                      
                      <div className="form-group mt-4">
                        <label className="form-label">5. Comments on Teaching, Learning and Assessment (Optional)</label>
                        <textarea className="form-textarea" rows={3} value={form.teachingLearning.comment} onChange={(e) => updateNestedForm('teachingLearning', 'comment', e.target.value)} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Academic and Laboratory Facilities */}
                {currentStepType.type === 'facilities' && (
                  <motion.div
                    key="step-facilities"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <FlaskConical size={22} className="form-step-icon" />
                      Academic & Laboratory Facilities
                    </h2>
                    <p className="form-step-desc">Rate the following from Strongly Disagree to Strongly Agree</p>
                    
                    <div className="likert-section">
                      <LikertScale 
                        question="1. The overall environment in the class was conducive to learning" 
                        value={form.academicFacilities.q1_environment} 
                        onChange={(v) => updateNestedForm('academicFacilities', 'q1_environment', v)} 
                      />
                      <LikertScale 
                        question="2. Classrooms were satisfactory" 
                        value={form.academicFacilities.q2_classrooms} 
                        onChange={(v) => updateNestedForm('academicFacilities', 'q2_classrooms', v)} 
                      />
                      <LikertScale 
                        question="3. Laboratory facilities were adequate and appropriate" 
                        value={form.academicFacilities.q3_laboratory} 
                        onChange={(v) => updateNestedForm('academicFacilities', 'q3_laboratory', v)} 
                      />
                      
                      <div className="form-group mt-4">
                        <label className="form-label">4. Comments on Academic & Laboratory Facilities (Optional)</label>
                        <textarea className="form-textarea" rows={3} value={form.academicFacilities.comment} onChange={(e) => updateNestedForm('academicFacilities', 'comment', e.target.value)} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Review & Submit */}
                {currentStepType.type === 'submit' && (
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
                      {form.courseName && (
                        <div className="review-row">
                          <span className="review-label">Course</span>
                          <span className="review-value">{form.courseName}</span>
                        </div>
                      )}
                      
                      <div className="divider" style={{ margin: 'var(--sp-4) 0' }} />

                      <h4 className="review-section-title">Sections Completed</h4>
                      
                      <div className="review-row">
                        <span className="review-label">Course Content & Organisation</span>
                        <span className="review-value" style={{ color: 'var(--ruet-emerald)' }}>✓ Completed</span>
                      </div>
                      
                      {courseOutcomes.map((co, i) => (
                        <div className="review-row" key={i}>
                          <span className="review-label">CO{co.coNumber || (i + 1)}: {co.title}</span>
                          <span className="review-value" style={{ color: 'var(--ruet-emerald)' }}>✓ Completed</span>
                        </div>
                      ))}

                      <div className="review-row">
                        <span className="review-label">Teaching-Learning & Assessment</span>
                        <span className="review-value" style={{ color: 'var(--ruet-emerald)' }}>✓ Completed</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">Academic & Lab Facilities</span>
                        <span className="review-value" style={{ color: 'var(--ruet-emerald)' }}>✓ Completed</span>
                      </div>
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
                {step > 0 ? (
                  <button onClick={handlePrevStep} className="btn btn-secondary">
                    <ChevronLeft size={18} />
                    Back
                  </button>
                ) : <div />}
                
                <div style={{ flex: 1 }} />
                
                {step < STEPS.length - 1 ? (
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
