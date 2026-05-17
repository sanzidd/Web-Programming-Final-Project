import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, User, Star as StarIcon, MessageSquare, CheckCircle2, 
  Shield, ChevronRight, ChevronLeft, Send, Sparkles, BookOpen
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import './FeedbackForm.css';

const STEPS = [
  { label: 'Select', icon: Building2 },
  { label: 'Rate', icon: StarIcon },
  { label: 'Comment', icon: MessageSquare },
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

  const [form, setForm] = useState({
    department: '',
    teacher: '',
    courseName: '',
    rating: 0,
    teachingQuality: 0,
    communication: 0,
    helpfulness: 0,
    comment: '',
  });

  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [selectedTeacherName, setSelectedTeacherName] = useState('');

  useEffect(() => {
    api.get('/departments')
      .then(res => setDepartments(res.data))
      .catch(() => toast.error('Failed to load departments'));
  }, []);

  useEffect(() => {
    if (form.department) {
      api.get(`/teachers?department=${form.department}`)
        .then(res => setTeachers(res.data))
        .catch(() => toast.error('Failed to load teachers'));
    } else {
      setTeachers([]);
    }
  }, [form.department]);

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

  const canNext = () => {
    if (step === 0) return form.department && form.teacher;
    if (step === 1) return form.rating && form.teachingQuality && form.communication && form.helpfulness;
    if (step === 2) return true;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/feedback', form);
      setSubmitted(true);
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
      rating: 0, teachingQuality: 0, communication: 0, helpfulness: 0,
      comment: '',
    });
    setStep(0);
    setSubmitted(false);
    setSelectedDeptName('');
    setSelectedTeacherName('');
  };

  const selectedTeacher = teachers.find(t => t._id === form.teacher);

  if (submitted) {
    return (
      <div className="feedback-page page-transition">
        <div className="container container-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="success-card"
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
    <div className="feedback-page page-transition">
      <div className="container container-sm">
        {/* Header */}
        <div className="feedback-header">
          <div className="anonymity-badge">
            <Shield size={16} />
            <span>100% Anonymous</span>
          </div>
          <h1 className="font-display feedback-title">
            Share Your <span className="text-gradient">Feedback</span>
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
            <Shield size={48} style={{ color: '#3b82f6', margin: '0 auto 20px' }} />
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
                    {i < step ? <CheckCircle2 size={16} /> : <s.icon size={16} />}
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
                      <label className="form-label">Course Name (Optional)</label>
                      <select
                        className="form-select"
                        value={form.courseName}
                        onChange={e => setForm(f => ({ ...f, courseName: e.target.value }))}
                        id="select-course"
                      >
                        <option value="">Select a course...</option>
                        {selectedTeacher.courses?.map((c, i) => (
                          <option key={i} value={c}>{c}</option>
                        ))}
                      </select>
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
                  <StarIcon size={22} className="form-step-icon" />
                  Rate Your Experience
                </h2>
                <p className="form-step-desc">Rate {selectedTeacherName} on the following criteria:</p>

                <div className="ratings-grid">
                  <div className="rating-row">
                    <StarRating
                      label="⭐ Overall Rating"
                      value={form.rating}
                      onChange={(v) => setForm(f => ({ ...f, rating: v }))}
                      size={32}
                    />
                  </div>
                  <div className="rating-row">
                    <StarRating
                      label="📚 Teaching Quality"
                      value={form.teachingQuality}
                      onChange={(v) => setForm(f => ({ ...f, teachingQuality: v }))}
                      size={32}
                    />
                  </div>
                  <div className="rating-row">
                    <StarRating
                      label="🗣️ Communication"
                      value={form.communication}
                      onChange={(v) => setForm(f => ({ ...f, communication: v }))}
                      size={32}
                    />
                  </div>
                  <div className="rating-row">
                    <StarRating
                      label="🤝 Helpfulness"
                      value={form.helpfulness}
                      onChange={(v) => setForm(f => ({ ...f, helpfulness: v }))}
                      size={32}
                    />
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
                  <MessageSquare size={22} className="form-step-icon" />
                  Leave a Comment (Optional)
                </h2>
                <p className="form-step-desc">Share specific feedback to help improve teaching quality.</p>

                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    placeholder="Write your honest feedback here... (e.g., teaching style, course materials, availability, suggestions)"
                    value={form.comment}
                    onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                    rows={6}
                    maxLength={1000}
                    id="feedback-comment"
                  />
                  <div className="char-counter">
                    {form.comment.length} / 1000 characters
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
                  <div className="review-row">
                    <span className="review-label">Overall Rating</span>
                    <span className="review-value review-stars">{'⭐'.repeat(form.rating)}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Teaching Quality</span>
                    <span className="review-value review-stars">{'⭐'.repeat(form.teachingQuality)}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Communication</span>
                    <span className="review-value review-stars">{'⭐'.repeat(form.communication)}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Helpfulness</span>
                    <span className="review-value review-stars">{'⭐'.repeat(form.helpfulness)}</span>
                  </div>
                  {form.comment && (
                    <>
                      <div className="divider" style={{ margin: 'var(--sp-4) 0' }} />
                      <div className="review-comment">
                        <span className="review-label">Comment</span>
                        <p className="review-comment-text">"{form.comment}"</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="anonymity-notice">
                  <Shield size={18} />
                  <span>This feedback is completely anonymous. No personal data is collected.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="form-nav">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="btn btn-secondary">
                <ChevronLeft size={18} />
                Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
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
                disabled={loading}
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
