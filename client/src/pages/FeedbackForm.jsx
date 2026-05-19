import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, User, Star as StarIcon, MessageSquare, CheckCircle2, 
  Shield, ChevronRight, ChevronLeft, Send, Sparkles, BookOpen, Book, Users, Presentation, Lightbulb
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import LikertScale from '../components/LikertScale';
import './FeedbackForm.css';

const STEPS = [
  { label: 'Select', icon: Building2 },
  { label: 'Content', icon: Book },
  { label: 'Environment', icon: Presentation },
  { label: 'Teacher', icon: Users },
  { label: 'Rating', icon: StarIcon },
  { label: 'Submit', icon: Send },
];

export default function FeedbackForm() {
  const { isStudent } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const formRef = useRef(null);

  const [form, setForm] = useState({
    department: '',
    teacher: '',
    courseName: '',
    courseContent: { q1: 0, q2: 0, q3: 0, comment: '' },
    studentContribution: { q5: 0, q6: 0, comment: '' },
    learningEnvironment: { q8: 0, q9: 0, q10: 0, q11: 0, comment: '' },
    learningResources: { q13: 0, q14: 0, q15: 0, comment: '' },
    courseTeacher: { q17: 0, q18: 0, q19: 0, q20: 0, q21: 0, q22: 0, comment: '' },
    courseRating: { structure: 0, delivery: 0, duration: 0, environment: 0, skill: 0, overall: 0, comment: '' },
    overallFeedback: ''
  });

  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [selectedTeacherName, setSelectedTeacherName] = useState('');

  useEffect(() => {
    api.get('/departments')
      .then(res => setDepartments(res.data))
      .catch(() => toast.error('Failed to load departments'));
  }, [toast]);

  useEffect(() => {
    if (form.department) {
      api.get(`/teachers?department=${form.department}`)
        .then(res => setTeachers(res.data))
        .catch(() => toast.error('Failed to load teachers'));
    } else {
      setTeachers([]);
    }
  }, [form.department, toast]);

  const handleDeptChange = (e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, department: val, teacher: '', courseName: '' }));
    const dept = departments.find(d => d._id === val);
    setSelectedDeptName(dept ? dept.name : '');
  };

  const handleTeacherChange = (e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, teacher: val, courseName: '' }));
    const t = teachers.find(t => t._id === val);
    setSelectedTeacherName(t ? t.name : '');
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

  const canNext = () => {
    if (step === 0) return form.department && form.teacher && form.courseName.trim() !== '';
    if (step === 1) return form.courseContent.q1 && form.courseContent.q2 && form.courseContent.q3 && 
                           form.studentContribution.q5 && form.studentContribution.q6;
    if (step === 2) return form.learningEnvironment.q8 && form.learningEnvironment.q9 && form.learningEnvironment.q10 && form.learningEnvironment.q11 &&
                           form.learningResources.q13 && form.learningResources.q14 && form.learningResources.q15;
    if (step === 3) return form.courseTeacher.q17 && form.courseTeacher.q18 && form.courseTeacher.q19 && 
                           form.courseTeacher.q20 && form.courseTeacher.q21 && form.courseTeacher.q22;
    if (step === 4) return form.courseRating.structure && form.courseRating.delivery && form.courseRating.duration && 
                           form.courseRating.environment && form.courseRating.skill && form.courseRating.overall && form.overallFeedback.trim() !== '';
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/feedback', form);
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
      courseContent: { q1: 0, q2: 0, q3: 0, comment: '' },
      studentContribution: { q5: 0, q6: 0, comment: '' },
      learningEnvironment: { q8: 0, q9: 0, q10: 0, q11: 0, comment: '' },
      learningResources: { q13: 0, q14: 0, q15: 0, comment: '' },
      courseTeacher: { q17: 0, q18: 0, q19: 0, q20: 0, q21: 0, q22: 0, comment: '' },
      courseRating: { structure: 0, delivery: 0, duration: 0, environment: 0, skill: 0, overall: 0, comment: '' },
      overallFeedback: ''
    });
    setStep(0);
    setSubmitted(false);
    setSelectedDeptName('');
    setSelectedTeacherName('');
    scrollToTop();
  };

  const selectedTeacher = teachers.find(t => t._id === form.teacher);

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
                {step === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <Building2 size={22} className="form-step-icon" />
                      Select Department & Teacher
                    </h2>

                    <div className="form-group">
                      <label className="form-label">Department *</label>
                      <select
                        className="form-select"
                        value={form.department}
                        onChange={handleDeptChange}
                        id="select-department"
                      >
                        <option value="">Choose a department...</option>
                        {departments.map(d => (
                          <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                        ))}
                      </select>
                    </div>

                    {form.department && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="form-group"
                      >
                        <label className="form-label">Teacher *</label>
                        <select
                          className="form-select"
                          value={form.teacher}
                          onChange={handleTeacherChange}
                          id="select-teacher"
                        >
                          <option value="">Choose a teacher...</option>
                          {teachers.map(t => (
                            <option key={t._id} value={t._id}>
                              {t.name} — {t.designation}
                            </option>
                          ))}
                        </select>
                      </motion.div>
                    )}

                    {selectedTeacher && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="selected-teacher-card">
                          <div className="teacher-avatar">
                            <User size={28} />
                          </div>
                          <div className="teacher-info-brief">
                            <h4>{selectedTeacher.name}</h4>
                            <span>{selectedTeacher.designation}</span>
                            <div className="teacher-courses">
                              {selectedTeacher.courses?.map((c, i) => (
                                <span key={i} className="badge badge-blue">
                                  <BookOpen size={10} /> {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="form-group" style={{ marginTop: 'var(--sp-4)' }}>
                          <label className="form-label">Course Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter the course name (e.g. CSE 4101)"
                            value={form.courseName}
                            onChange={e => setForm(f => ({ ...f, courseName: e.target.value }))}
                            id="input-course"
                          />
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <Book size={22} className="form-step-icon" />
                      Course Content & Organization
                    </h2>
                    
                    <div className="likert-section">
                      <LikertScale question="1. The course objectives were clear" value={form.courseContent.q1} onChange={(v) => updateNestedForm('courseContent', 'q1', v)} />
                      <LikertScale question="2. The course workload was manageable" value={form.courseContent.q2} onChange={(v) => updateNestedForm('courseContent', 'q2', v)} />
                      <LikertScale question="3. The course was well organized (e.g. timely access to materials, notification of changes, etc.)" value={form.courseContent.q3} onChange={(v) => updateNestedForm('courseContent', 'q3', v)} />
                      
                      <div className="form-group mt-4">
                        <label className="form-label">4. Comments on Course Content and Organization (Optional)</label>
                        <textarea className="form-textarea" rows={3} value={form.courseContent.comment} onChange={(e) => updateNestedForm('courseContent', 'comment', e.target.value)} />
                      </div>
                    </div>

                    <h2 className="form-step-title mt-8">
                      <User size={22} className="form-step-icon" />
                      Student Contribution
                    </h2>
                    
                    <div className="likert-section">
                      <LikertScale question="5. I participated actively in the course" value={form.studentContribution.q5} onChange={(v) => updateNestedForm('studentContribution', 'q5', v)} />
                      <LikertScale question="6. I think I have made progress in this course" value={form.studentContribution.q6} onChange={(v) => updateNestedForm('studentContribution', 'q6', v)} />
                      
                      <div className="form-group mt-4">
                        <label className="form-label">7. Comments on Student Contribution (Optional)</label>
                        <textarea className="form-textarea" rows={3} value={form.studentContribution.comment} onChange={(e) => updateNestedForm('studentContribution', 'comment', e.target.value)} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <Presentation size={22} className="form-step-icon" />
                      Learning Environment & Teaching Methods
                    </h2>
                    
                    <div className="likert-section">
                      <LikertScale question="8. I think the course was well structured to achieve the learning outcomes" value={form.learningEnvironment.q8} onChange={(v) => updateNestedForm('learningEnvironment', 'q8', v)} />
                      <LikertScale question="9. The learning and teaching methods encouraged participation" value={form.learningEnvironment.q9} onChange={(v) => updateNestedForm('learningEnvironment', 'q9', v)} />
                      <LikertScale question="10. The overall environment in the class was conducive to learning" value={form.learningEnvironment.q10} onChange={(v) => updateNestedForm('learningEnvironment', 'q10', v)} />
                      <LikertScale question="11. Classrooms were satisfactory" value={form.learningEnvironment.q11} onChange={(v) => updateNestedForm('learningEnvironment', 'q11', v)} />
                      
                      <div className="form-group mt-4">
                        <label className="form-label">12. Comments on Learning Environment (Optional)</label>
                        <textarea className="form-textarea" rows={3} value={form.learningEnvironment.comment} onChange={(e) => updateNestedForm('learningEnvironment', 'comment', e.target.value)} />
                      </div>
                    </div>

                    <h2 className="form-step-title mt-8">
                      <Lightbulb size={22} className="form-step-icon" />
                      Learning Resources
                    </h2>
                    
                    <div className="likert-section">
                      <LikertScale question="13. Learning materials (lesson plans, course notes, etc.) were relevant and useful" value={form.learningResources.q13} onChange={(v) => updateNestedForm('learningResources', 'q13', v)} />
                      <LikertScale question="14. Recommended reading books etc. were relevant and appropriate" value={form.learningResources.q14} onChange={(v) => updateNestedForm('learningResources', 'q14', v)} />
                      <LikertScale question="15. The provision of learning resources in the library was adequate and appropriate" value={form.learningResources.q15} onChange={(v) => updateNestedForm('learningResources', 'q15', v)} />
                      
                      <div className="form-group mt-4">
                        <label className="form-label">16. Comments on Learning Resources (Optional)</label>
                        <textarea className="form-textarea" rows={3} value={form.learningResources.comment} onChange={(e) => updateNestedForm('learningResources', 'comment', e.target.value)} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <Users size={22} className="form-step-icon" />
                      Course Teacher Evaluation
                    </h2>
                    <p className="form-step-desc">Evaluate {selectedTeacherName}</p>
                    
                    <div className="likert-section">
                      <LikertScale question="17. Course teacher showed empathy and helped solving critical problems" value={form.courseTeacher.q17} onChange={(v) => updateNestedForm('courseTeacher', 'q17', v)} />
                      <LikertScale question="18. You felt that course teacher is an expert of this course" value={form.courseTeacher.q18} onChange={(v) => updateNestedForm('courseTeacher', 'q18', v)} />
                      <LikertScale question="19. Delivery skill of teacher was satisfactory" value={form.courseTeacher.q19} onChange={(v) => updateNestedForm('courseTeacher', 'q19', v)} />
                      <LikertScale question="20. Course teacher responded to your queries" value={form.courseTeacher.q20} onChange={(v) => updateNestedForm('courseTeacher', 'q20', v)} />
                      <LikertScale question="21. Communication skill of teacher was satisfactory" value={form.courseTeacher.q21} onChange={(v) => updateNestedForm('courseTeacher', 'q21', v)} />
                      <LikertScale question="22. You felt comfortable expressing your problems to your course teacher" value={form.courseTeacher.q22} onChange={(v) => updateNestedForm('courseTeacher', 'q22', v)} />
                      
                      <div className="form-group mt-4">
                        <label className="form-label">23. Comments on Course Teacher (Optional)</label>
                        <textarea className="form-textarea" rows={3} value={form.courseTeacher.comment} onChange={(e) => updateNestedForm('courseTeacher', 'comment', e.target.value)} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="form-step"
                  >
                    <h2 className="form-step-title">
                      <StarIcon size={22} className="form-step-icon" />
                      Course Rating (1 to 5)
                    </h2>
                    <p className="form-step-desc">Rate the following criteria out of 5 stars.</p>

                    <div className="ratings-grid">
                      <div className="rating-row">
                        <StarRating label="24. Course Structure and Contents" value={form.courseRating.structure} onChange={(v) => updateNestedForm('courseRating', 'structure', v)} size={32} />
                      </div>
                      <div className="rating-row">
                        <StarRating label="25. Delivery Quality of Teacher" value={form.courseRating.delivery} onChange={(v) => updateNestedForm('courseRating', 'delivery', v)} size={32} />
                      </div>
                      <div className="rating-row">
                        <StarRating label="26. Course Duration" value={form.courseRating.duration} onChange={(v) => updateNestedForm('courseRating', 'duration', v)} size={32} />
                      </div>
                      <div className="rating-row">
                        <StarRating label="27. Environment" value={form.courseRating.environment} onChange={(v) => updateNestedForm('courseRating', 'environment', v)} size={32} />
                      </div>
                      <div className="rating-row">
                        <StarRating label="28. New Skill Acquisition/Old Skill Developed" value={form.courseRating.skill} onChange={(v) => updateNestedForm('courseRating', 'skill', v)} size={32} />
                      </div>
                      <div className="rating-row">
                        <StarRating label="29. Overall Rating" value={form.courseRating.overall} onChange={(v) => updateNestedForm('courseRating', 'overall', v)} size={32} />
                      </div>
                    </div>
                    
                    <div className="form-group mt-4">
                      <label className="form-label">30. Comments on Course Rating (Optional)</label>
                      <textarea className="form-textarea" rows={3} value={form.courseRating.comment} onChange={(e) => updateNestedForm('courseRating', 'comment', e.target.value)} />
                    </div>

                    <h2 className="form-step-title mt-8">
                      <MessageSquare size={22} className="form-step-icon" />
                      Any Other Feedback
                    </h2>
                    <div className="form-group">
                      <label className="form-label">31. Provide feedback to improve the course *</label>
                      <textarea className="form-textarea" rows={5} placeholder="Your detailed feedback is required..." value={form.overallFeedback} onChange={(e) => setForm(f => ({ ...f, overallFeedback: e.target.value }))} />
                    </div>
                  </motion.div>
                )}

                {step === 5 && (
                  <motion.div
                    key="step5"
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
                      <h4 className="review-section-title">Final Course Rating</h4>
                      
                      <div className="review-row">
                        <span className="review-label">Overall Rating</span>
                        <span className="review-value review-stars">{'⭐'.repeat(form.courseRating.overall)}</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">Teacher Delivery</span>
                        <span className="review-value review-stars">{'⭐'.repeat(form.courseRating.delivery)}</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">Course Structure</span>
                        <span className="review-value review-stars">{'⭐'.repeat(form.courseRating.structure)}</span>
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
