import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  BarChart3, Star, Users, BookOpen, TrendingUp, MessageSquare,
  ThumbsUp, Minus, ThumbsDown, ChevronRight, Loader2, GraduationCap, Lock
} from 'lucide-react';
import './TeacherDashboard.css';

function StarDisplay({ rating, max = 5 }) {
  return (
    <div className="star-display">
      {[...Array(max)].map((_, i) => (
        <Star
          key={i}
          size={16}
          fill={i < Math.round(rating) ? 'var(--ruet-gold)' : 'none'}
          stroke={i < Math.round(rating) ? 'var(--ruet-gold)' : 'var(--text-muted)'}
        />
      ))}
      <span className="star-value">{rating}</span>
    </div>
  );
}

function SentimentBar({ counts }) {
  const total = counts.positive + counts.neutral + counts.negative || 1;
  const pPct = Math.round((counts.positive / total) * 100);
  const nePct = Math.round((counts.neutral / total) * 100);
  const ngPct = 100 - pPct - nePct;

  return (
    <div className="sentiment-bar-wrap">
      <div className="sentiment-bar">
        {pPct > 0 && <div className="sentiment-seg positive" style={{ width: `${pPct}%` }} />}
        {nePct > 0 && <div className="sentiment-seg neutral" style={{ width: `${nePct}%` }} />}
        {ngPct > 0 && <div className="sentiment-seg negative" style={{ width: `${ngPct}%` }} />}
      </div>
      <div className="sentiment-labels">
        <span className="sentiment-label positive"><ThumbsUp size={12} /> {counts.positive}</span>
        <span className="sentiment-label neutral"><Minus size={12} /> {counts.neutral}</span>
        <span className="sentiment-label negative"><ThumbsDown size={12} /> {counts.negative}</span>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const { teacherUser, isTeacher, updateTeacherUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mandatory password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    if (!isTeacher) {
      navigate('/teacher/login');
      return;
    }
    fetchDashboard();
  }, [isTeacher]);

  useEffect(() => {
    if (teacherUser && teacherUser.forcePasswordChange) {
      setShowPasswordModal(true);
    }
  }, [teacherUser]);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/teacher-auth/dashboard');
      setData(res.data);
    } catch (err) {
      showToast('Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    setChangingPass(true);
    try {
      const res = await api.post('/teacher-auth/change-password', { currentPassword, newPassword });
      showToast(res.data.message || 'Password updated successfully!', 'success');
      if (updateTeacherUser && res.data.teacherUser) {
        updateTeacherUser(res.data.teacherUser);
      }
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setChangingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="td-loading">
        <Loader2 size={40} className="spin" />
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="td-loading">
        <p>Unable to load dashboard data.</p>
      </div>
    );
  }

  const { teacher, summary, courses } = data;

  return (
    <div className="teacher-dashboard">
      <div className="container">
        {/* Header */}
        <div className="td-header">
          <div className="td-header-left">
          {/* Change Password Button */}
          <button className="btn btn-primary" onClick={() => setShowPasswordModal(true)} style={{ marginLeft: 'auto' }}>Change Password</button>
            <div className="td-avatar">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="td-name font-display">{teacher?.name || teacherUser?.name}</h1>
              <p className="td-meta">
                {teacher?.designation} · {teacher?.department?.name || 'Department'}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="td-stats-grid">
          <div className="td-stat-card">
            <div className="td-stat-icon" style={{ background: 'var(--ruet-gold-dim)' }}>
              <MessageSquare size={22} style={{ color: 'var(--ruet-gold)' }} />
            </div>
            <div className="td-stat-value font-display">{summary.totalFeedbacks}</div>
            <div className="td-stat-label">Total Feedbacks</div>
          </div>
          <div className="td-stat-card">
            <div className="td-stat-icon" style={{ background: 'var(--ruet-emerald-dim)' }}>
              <BookOpen size={22} style={{ color: 'var(--ruet-emerald)' }} />
            </div>
            <div className="td-stat-value font-display">{summary.totalCourses}</div>
            <div className="td-stat-label">Courses</div>
          </div>
          <div className="td-stat-card">
            <div className="td-stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
              <Star size={22} style={{ color: '#818CF8' }} />
            </div>
            <div className="td-stat-value font-display">{summary.overallAvg}</div>
            <div className="td-stat-label">Overall Rating</div>
          </div>
          <div className="td-stat-card">
            <div className="td-stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)' }}>
              <TrendingUp size={22} style={{ color: '#F43F5E' }} />
            </div>
            <div className="td-stat-value font-display">
              {summary.sentimentCounts.positive > 0
                ? Math.round((summary.sentimentCounts.positive / (summary.totalFeedbacks || 1)) * 100)
                : 0}%
            </div>
            <div className="td-stat-label">Positive Sentiment</div>
          </div>
        </div>

        {/* Rating Breakdown */}
        <div className="td-section">
          <h2 className="td-section-title font-display">
            <BarChart3 size={20} /> Rating Breakdown
          </h2>
          <div className="td-rating-grid">
            {[
              { label: 'Course Content & Organisation', value: summary.avgCourseContent },
              { label: 'Teaching-Learning & Assessment', value: summary.avgTeachingLearning },
              { label: 'Academic & Lab Facilities', value: summary.avgFacilities },
              { label: 'CO Attainment', value: summary.avgCOAttainment },
              { label: 'Overall', value: summary.overallAvg },
            ].map(item => (
              <div key={item.label} className="td-rating-item">
                <div className="td-rating-label">{item.label}</div>
                <div className="td-rating-bar-wrap">
                  <div className="td-rating-bar">
                    <div
                      className="td-rating-fill"
                      style={{ width: `${(item.value / 5) * 100}%` }}
                    />
                  </div>
                  <span className="td-rating-num">{item.value}/5</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Overview */}
        <div className="td-section">
          <h2 className="td-section-title font-display">
            <Users size={20} /> Sentiment Overview
          </h2>
          <SentimentBar counts={summary.sentimentCounts} />
        </div>

        {/* Assigned Courses Section */}
        <div className="td-section">
          <h2 className="td-section-title font-display">
            <BookOpen size={20} /> Assigned Courses
          </h2>
          {(!data.assignedCourses || data.assignedCourses.length === 0) ? (
            <div className="td-empty">
              <p>No active course assignments found for this semester.</p>
            </div>
          ) : (
            <div className="td-courses-grid">
              {data.assignedCourses.map((assign, idx) => {
                const fbCourse = courses.find(c => c.courseName.toLowerCase() === assign.courseName?.toLowerCase() || (assign.courseCode && c.courseName.toLowerCase().includes(assign.courseCode.toLowerCase())));
                return (
                  <div key={idx} className="td-course-card glass-card" style={{ cursor: 'default' }}>
                    <div className="td-course-header">
                      <div>
                        <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--ruet-gold)', fontWeight: 600, display: 'inline-block', marginBottom: '6px' }}>
                          {assign.courseCode || 'Course'}
                        </span>
                        <h3 className="td-course-name">{assign.courseName}</h3>
                      </div>
                      {fbCourse && (
                        <Link to={`/teacher/course/${encodeURIComponent(fbCourse.courseName)}`} className="btn btn-outline btn-sm" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          View Feedback <ChevronRight size={14} />
                        </Link>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div><strong>Series:</strong> {assign.series || 'N/A'}</div>
                      <div><strong>Semester:</strong> {assign.semester || 'N/A'}</div>
                      <div><strong>Dept:</strong> {assign.department?.code || assign.department?.name || 'N/A'}</div>
                    </div>
                    {fbCourse ? (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--ruet-emerald)' }}>● Feedback Available ({fbCourse.totalFeedbacks})</span>
                        <StarDisplay rating={fbCourse.avgOverall} />
                      </div>
                    ) : (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ○ Awaiting student evaluations
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Course Cards */}
        <div className="td-section">
          <h2 className="td-section-title font-display">
            <BookOpen size={20} /> Course Feedback
          </h2>
          {courses.length === 0 ? (
            <div className="td-empty">
              <p>No feedback received yet. Course feedback will appear here once students submit reviews.</p>
            </div>
          ) : (
            <div className="td-courses-grid">
              {courses.map(course => (
                <Link
                  key={course.courseName}
                  to={`/teacher/course/${encodeURIComponent(course.courseName)}`}
                  className="td-course-card glass-card"
                >
                  <div className="td-course-header">
                    <h3 className="td-course-name">{course.courseName}</h3>
                    <ChevronRight size={18} className="td-course-arrow" />
                  </div>
                  <div className="td-course-stats">
                    <div className="td-course-stat">
                      <MessageSquare size={14} />
                      <span>{course.totalFeedbacks} feedbacks</span>
                    </div>
                    <StarDisplay rating={course.avgOverall} />
                  </div>
                  <SentimentBar counts={course.sentimentCounts} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.85)', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '450px', padding: '35px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--ruet-gold-dim)', color: 'var(--ruet-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Lock size={26} />
              </div>
              <h3 className="font-display" style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '8px' }}>Mandatory Password Reset</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                For security reasons, you must change your default password before accessing your dashboard.
              </p>
            </div>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter default password (e.g., 12345678)"
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={changingPass}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {changingPass ? <Loader2 size={18} className="spin" /> : <Lock size={18} />}
                {changingPass ? 'Updating Password...' : 'Update Password & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
