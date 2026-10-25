import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  GraduationCap, BookOpen, User, CheckCircle2, Clock, 
  Search, ArrowRight, ShieldAlert, Target, Building2,
  Calendar, Layers, Sparkles, Key, Lock, Eye, EyeOff, X, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import './StudentDashboard.css';

export default function StudentDashboard() {
  const { student, isStudent, loading: authLoading, refreshStudentProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'reviewed'
  const [searchQuery, setSearchQuery] = useState('');

  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isStudent) {
      navigate('/student/login');
      return;
    }

    if (refreshStudentProfile) {
      refreshStudentProfile();
    }

    const fetchMyAssignments = async () => {
      try {
        const res = await api.get('/feedback/my-assignments');
        setAssignments(res.data || []);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load assigned courses');
      } finally {
        setLoading(false);
      }
    };

    fetchMyAssignments();
  }, [isStudent, navigate]);

  // Compute stats
  const totalCourses = assignments.length;
  const reviewedCount = assignments.filter(a => a.alreadyReviewed).length;
  const pendingCount = totalCourses - reviewedCount;
  const completionPct = totalCourses > 0 ? Math.round((reviewedCount / totalCourses) * 100) : 0;

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return assignments.filter(a => {
      // Tab filter
      if (filterTab === 'reviewed' && !a.alreadyReviewed) return false;
      if (filterTab === 'pending' && a.alreadyReviewed) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cName = (a.courseName || '').toLowerCase();
        const cCode = (a.courseCode || '').toLowerCase();
        const tName = (a.teacher?.name || '').toLowerCase();
        const dept = (a.department?.name || a.department?.code || '').toLowerCase();
        return cName.includes(q) || cCode.includes(q) || tName.includes(q) || dept.includes(q);
      }
      return true;
    });
  }, [assignments, filterTab, searchQuery]);

  const handleGiveFeedback = (assignmentId) => {
    navigate('/feedback', { state: { assignmentId } });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setChangingPass(true);
    try {
      const res = await api.post('/students/change-password', {
        currentPassword,
        newPassword
      });
      toast.success(res.data.message || 'Password changed successfully!');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="student-dashboard-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px' }} />
          <p>Loading your assigned courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-dashboard-page page-transition">
      <div className="student-dashboard-container">
        
        {/* Hero Welcome Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="student-hero-card"
        >
          <div className="student-hero-info">
            <div className="student-avatar">
              <GraduationCap size={32} />
            </div>
            <div>
              <h1 className="student-hero-title font-display">
                Welcome, {student?.name || 'Student'}
              </h1>
              <div className="student-hero-meta">
                <span className="student-hero-tag">
                  Roll: {student?.roll || 'N/A'}
                </span>
                {student?.series && (
                  <span className="student-hero-tag">
                    Series '{student?.series}
                  </span>
                )}
                {student?.department?.code && (
                  <span className="student-hero-tag">
                    Dept: {student?.department?.code}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="student-hero-actions">
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="btn btn-student-change-pwd"
              title="Change Password"
            >
              <Key size={16} />
              <span>Change Password</span>
            </button>
            <button 
              onClick={() => navigate('/feedback')}
              className="btn btn-primary btn-student-feedback"
            >
              <span>Submit Feedback</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="student-stats-grid">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="student-stat-card glass-card"
          >
            <div className="student-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA' }}>
              <BookOpen size={24} />
            </div>
            <div>
              <div className="student-stat-val font-display">{totalCourses}</div>
              <div className="student-stat-label">Assigned Courses</div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="student-stat-card glass-card"
          >
            <div className="student-stat-icon" style={{ background: 'rgba(15, 123, 95, 0.15)', color: '#34D399' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="student-stat-val font-display">{reviewedCount}</div>
              <div className="student-stat-label">Reviewed</div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="student-stat-card glass-card"
          >
            <div className="student-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' }}>
              <Clock size={24} />
            </div>
            <div>
              <div className="student-stat-val font-display">{pendingCount}</div>
              <div className="student-stat-label">Pending Reviews</div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="student-stat-card glass-card"
          >
            <div className="student-stat-icon" style={{ background: 'rgba(185, 28, 58, 0.15)', color: '#F43F5E' }}>
              <Sparkles size={24} />
            </div>
            <div>
              <div className="student-stat-val font-display">{completionPct}%</div>
              <div className="student-stat-label">Completion</div>
            </div>
          </motion.div>
        </div>

        {/* Controls: Tabs & Search */}
        <div className="student-controls-row">
          <div className="student-filter-tabs">
            <button
              className={`filter-tab ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              All Courses ({totalCourses})
            </button>
            <button
              className={`filter-tab ${filterTab === 'pending' ? 'active' : ''}`}
              onClick={() => setFilterTab('pending')}
            >
              Pending ({pendingCount})
            </button>
            <button
              className={`filter-tab ${filterTab === 'reviewed' ? 'active' : ''}`}
              onClick={() => setFilterTab('reviewed')}
            >
              Reviewed ({reviewedCount})
            </button>
          </div>

          <div className="student-search-box">
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by course or teacher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <div className="student-empty-state">
            <div className="student-empty-icon">
              <BookOpen size={32} />
            </div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
              {filterTab === 'pending' 
                ? 'All Caught Up!' 
                : filterTab === 'reviewed' 
                  ? 'No Feedback Submitted Yet' 
                  : 'No Assigned Courses Found'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 20px' }}>
              {filterTab === 'pending'
                ? 'You have completed feedback submissions for all your assigned courses. Great job!'
                : filterTab === 'reviewed'
                  ? 'Select a course from your pending list and submit your feedback.'
                  : 'No courses match your enrolled series/department or current search query.'}
            </p>
            {filterTab !== 'reviewed' && (
              <button 
                onClick={() => setFilterTab('all')} 
                className="btn btn-outline btn-sm"
              >
                View All Courses
              </button>
            )}
          </div>
        ) : (
          <div className="student-course-grid">
            {filteredCourses.map((item, idx) => {
              const isReviewed = item.alreadyReviewed;
              const isClosed = item.isReviewSessionOpen === false;

              return (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`student-course-card glass-card ${isReviewed ? 'reviewed' : 'pending'}`}
                >
                  <div>
                    <div className="course-card-top">
                      <span className="course-code-badge">
                        {item.courseCode || 'COURSE'}
                      </span>
                      {isReviewed ? (
                        <span className="course-status-badge reviewed">
                          <CheckCircle2 size={13} />
                          Reviewed
                        </span>
                      ) : isClosed ? (
                        <span className="course-status-badge closed">
                          <ShieldAlert size={13} />
                          Closed
                        </span>
                      ) : (
                        <span className="course-status-badge pending">
                          <Clock size={13} />
                          Pending Review
                        </span>
                      )}
                    </div>

                    <h3 className="course-card-title">
                      {item.courseName}
                    </h3>

                    <div className="course-meta-list">
                      <div className="course-meta-item">
                        <User size={15} style={{ color: 'var(--ruet-gold)' }} />
                        <span>Teacher: <strong>{item.teacher?.name || 'Assigned Faculty'}</strong> ({item.teacher?.designation || 'Faculty'})</span>
                      </div>
                      <div className="course-meta-item">
                        <Building2 size={15} style={{ color: '#60A5FA' }} />
                        <span>Dept: <strong>{item.department?.code || item.department?.name || 'RUET'}</strong></span>
                      </div>
                      <div className="course-meta-item">
                        <Calendar size={15} style={{ color: '#A78BFA' }} />
                        <span>Semester: <strong>{item.semester || 'Current'}</strong> | Series: <strong>{item.series || 'All'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="course-card-footer">
                    <div className="course-co-count">
                      <Target size={14} style={{ color: 'var(--ruet-emerald)' }} />
                      <span>{item.courseOutcomes?.length || 0} Course Outcomes</span>
                    </div>

                    {isReviewed ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--ruet-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={16} /> Completed
                      </span>
                    ) : isClosed ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Session Inactive
                      </span>
                    ) : (
                      <button
                        onClick={() => handleGiveFeedback(item._id)}
                        className="btn-give-feedback"
                      >
                        Give Review <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div 
          className="student-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !changingPass) {
              setShowPasswordModal(false);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="student-password-modal glass-card"
          >
            <div className="student-modal-header">
              <div className="student-modal-icon">
                <Lock size={22} />
              </div>
              <div>
                <h3 className="student-modal-title font-display">Change Password</h3>
                <p className="student-modal-subtitle">Update your student account security credentials</p>
              </div>
              <button 
                type="button" 
                onClick={() => !changingPass && setShowPasswordModal(false)}
                className="student-modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="student-password-form">
              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <div className="password-input-wrap">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    tabIndex={-1}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">New Password *</label>
                <div className="password-input-wrap">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <div className="student-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn btn-outline"
                  disabled={changingPass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={changingPass}
                >
                  {changingPass ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
