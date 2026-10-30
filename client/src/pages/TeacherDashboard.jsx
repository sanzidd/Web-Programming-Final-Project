/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  BarChart3, Star, BookOpen, MessageSquare,
  ChevronRight, Loader2, GraduationCap, Lock, Target, Plus, Trash2, Edit3, X, Save,
  Calendar, Clock, FileSpreadsheet, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import './TeacherDashboard.css';

function toLocalDatetimeInputValue(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDeadlineDisplay(dateVal) {
  if (!dateVal) return 'No deadline set';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return 'No deadline set';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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

export default function TeacherDashboard() {
  const { teacherUser, isTeacher, loading: authLoading, updateTeacherUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState(null);

  // Mandatory password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Course Outcomes management state
  const [selectedAssignmentForCO, setSelectedAssignmentForCO] = useState(null);
  const [showCOModal, setShowCOModal] = useState(false);
  const [coList, setCoList] = useState([]);
  const [savingCO, setSavingCO] = useState(false);

  // Deadline modal state
  const [selectedAssignmentForDeadline, setSelectedAssignmentForDeadline] = useState(null);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  const openCOModal = (assign) => {
    setSelectedAssignmentForCO(assign);
    if (assign.courseOutcomes && assign.courseOutcomes.length > 0) {
      setCoList(assign.courseOutcomes.map((co, idx) => ({
        coNumber: co.coNumber || idx + 1,
        title: co.title || '',
        description: co.description || ''
      })));
    } else {
      setCoList([{ coNumber: 1, title: 'CO1', description: '' }]);
    }
    setShowCOModal(true);
  };

  const addCO = () => {
    setCoList(prev => [...prev, { coNumber: prev.length + 1, title: `CO${prev.length + 1}`, description: '' }]);
  };

  const removeCO = (index) => {
    setCoList(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((co, idx) => ({ ...co, coNumber: idx + 1 }));
    });
  };

  const updateCO = (index, field, value) => {
    setCoList(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveCOs = async (e) => {
    e.preventDefault();
    if (!selectedAssignmentForCO) return;

    const validCOs = coList
      .filter(co => (co.title && co.title.trim()) || (co.description && co.description.trim()))
      .map((co, idx) => ({
        coNumber: idx + 1,
        title: (co.title && co.title.trim()) ? co.title.trim() : `CO${idx + 1}`,
        description: (co.description || '').trim()
      }));

    if (validCOs.length === 0) {
      showToast('Please enter at least one Course Outcome title or description', 'error');
      return;
    }

    setSavingCO(true);
    try {
      const res = await api.put(`/teacher-auth/assignments/${selectedAssignmentForCO._id}/course-outcomes`, {
        courseOutcomes: validCOs
      });
      showToast(res.data.message || 'Course Outcomes updated in database!', 'success');

      setData(prev => ({
        ...prev,
        assignedCourses: (prev?.assignedCourses || []).map(a =>
          a._id === selectedAssignmentForCO._id ? res.data.assignment : a
        )
      }));
      setShowCOModal(false);
      setSelectedAssignmentForCO(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update Course Outcomes', 'error');
    } finally {
      setSavingCO(false);
    }
  };

  const openDeadlineModal = (assign) => {
    setSelectedAssignmentForDeadline(assign);
    setDeadlineInput(toLocalDatetimeInputValue(assign.feedbackDeadline));
  };

  const applyQuickDaysExtension = (days) => {
    const base = deadlineInput ? new Date(deadlineInput) : new Date();
    const start = Number.isNaN(base.getTime()) || base.getTime() < Date.now() ? new Date() : base;
    start.setDate(start.getDate() + days);
    start.setHours(23, 59, 0, 0);
    setDeadlineInput(toLocalDatetimeInputValue(start));
  };

  const handleSaveDeadline = async (clear = false) => {
    if (!selectedAssignmentForDeadline) return;
    setSavingDeadline(true);
    try {
      const payload = {
        feedbackDeadline: clear || !deadlineInput ? null : new Date(deadlineInput).toISOString()
      };
      const res = await api.put(`/teacher-auth/assignments/${selectedAssignmentForDeadline._id}/deadline`, payload);
      showToast(res.data.message || 'Feedback deadline updated!', 'success');
      setData(prev => ({
        ...prev,
        assignedCourses: (prev?.assignedCourses || []).map(a =>
          a._id === selectedAssignmentForDeadline._id ? res.data.assignment : a
        )
      }));
      setSelectedAssignmentForDeadline(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update deadline', 'error');
    } finally {
      setSavingDeadline(false);
    }
  };

  const handleDownloadAssignmentReport = async (assign, format = 'excel') => {
    const key = `${format}-${assign._id}`;
    setDownloadingKey(key);
    try {
      const endpoint = format === 'word'
        ? `/teacher-auth/assignments/${assign._id}/export-doc`
        : `/teacher-auth/assignments/${assign._id}/export`;
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeCourse = (assign.courseName || 'Course').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = format === 'word'
        ? `Final_Feedback_${safeCourse}.docx`
        : `Student_Feedback_${safeCourse}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(format === 'word' ? 'Word report (.docx) downloaded!' : 'Excel report (.xlsx) downloaded!', 'success');
    } catch {
      showToast(`Failed to download ${format === 'word' ? 'Word' : 'Excel'} report`, 'error');
    } finally {
      setDownloadingKey(null);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isTeacher) {
      navigate('/teacher/login');
      return;
    }
    fetchDashboard();
  }, [isTeacher, authLoading]);

  useEffect(() => {
    if (teacherUser && teacherUser.forcePasswordChange) {
      setShowPasswordModal(true);
    }
  }, [teacherUser]);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/teacher-auth/dashboard');
      setData(res.data);
    } catch {
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
          <div className="td-header-right">
            <button className="btn btn-primary" onClick={() => setShowPasswordModal(true)}>
              Change Password
            </button>
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
            <div className="td-stat-value font-display">
              {summary.overallAvg > 0 ? summary.overallAvg : 'N/A'}
            </div>
            <div className="td-stat-label">Overall Rating</div>
          </div>
          <div className="td-stat-card">
            <div className="td-stat-icon" style={{ background: 'rgba(15, 123, 95, 0.15)' }}>
              <Target size={22} style={{ color: 'var(--ruet-emerald)' }} />
            </div>
            <div className="td-stat-value font-display">
              {summary.avgCOAttainment > 0 ? `${summary.avgCOAttainment}/5` : 'N/A'}
            </div>
            <div className="td-stat-label">CO Attainment</div>
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
              { label: 'CO Attainment', value: summary.avgCOAttainment },
              { label: 'Academic & Lab Facilities', value: summary.avgFacilities },
              { label: 'Course Teacher', value: summary.avgCourseTeacher || 0 },
              { label: 'Overall', value: summary.overallAvg },
            ].map(item => (
              <div key={item.label} className="td-rating-item">
                <div className="td-rating-label">{item.label}</div>
                <div className="td-rating-bar-wrap">
                  <div className="td-rating-bar">
                    <div
                      className="td-rating-fill"
                      style={{ width: `${item.value > 0 ? Math.min(100, Math.max(0, (item.value / 5) * 100)) : 0}%` }}
                    />
                  </div>
                  <span className="td-rating-num">{item.value > 0 ? `${item.value}/5` : '0/5'}</span>
                </div>
              </div>
            ))}
          </div>
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
                const fbCourse = courses.find(c =>
                  c.courseName.toLowerCase() === assign.courseName?.toLowerCase() ||
                  (assign.courseCode && c.courseName.toLowerCase().includes(assign.courseCode.toLowerCase()))
                );
                const isDeadlinePassed = Boolean(assign.isDeadlinePassed);
                const isOpen = assign.effectiveSessionOpen !== undefined
                  ? assign.effectiveSessionOpen
                  : (!isDeadlinePassed && assign.isReviewSessionOpen !== false);

                return (
                  <div key={assign._id || idx} className="td-course-card glass-card" style={{ cursor: 'default' }}>
                    <div className="td-course-header">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--ruet-gold)', fontWeight: 600 }}>
                            {assign.courseCode || 'Course'}
                          </span>
                          <span className={`badge ${isOpen ? 'badge-emerald' : 'badge-danger'}`} style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {isOpen ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                            {isOpen ? 'Session Open' : (isDeadlinePassed ? 'Deadline Passed' : 'Closed')}
                          </span>
                        </div>
                        <h3 className="td-course-name">{assign.courseName}</h3>
                      </div>
                      {fbCourse && (
                        <Link to={`/teacher/course/${encodeURIComponent(fbCourse.courseName)}`} className="btn btn-outline btn-sm" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          View Feedback <ChevronRight size={14} />
                        </Link>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '15px', marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <div><strong>Series:</strong> {assign.series || 'N/A'}</div>
                      <div><strong>Semester:</strong> {assign.semester || 'N/A'}</div>
                      <div><strong>Dept:</strong> {assign.department?.code || assign.department?.name || 'N/A'}</div>
                    </div>

                    {/* Feedback Deadline Row */}
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: isDeadlinePassed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isDeadlinePassed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                        <Clock size={14} style={{ color: isDeadlinePassed ? 'var(--text-danger)' : 'var(--ruet-gold)' }} />
                        <span style={{ color: isDeadlinePassed ? 'var(--text-danger)' : 'var(--text-secondary)' }}>
                          <strong>Deadline:</strong> {formatDeadlineDisplay(assign.feedbackDeadline)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openDeadlineModal(assign)}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 10px', fontSize: '0.76rem', color: 'var(--ruet-gold)', borderColor: 'rgba(212, 168, 67, 0.4)' }}
                      >
                        <Calendar size={12} /> {assign.feedbackDeadline ? 'Extend / Edit' : 'Set Deadline'}
                      </button>
                    </div>

                    {/* Course Outcomes badge & manage button */}
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                        <Target size={14} style={{ color: assign.courseOutcomes?.length > 0 ? 'var(--ruet-emerald)' : 'var(--ruet-gold)' }} />
                        <span style={{ color: assign.courseOutcomes?.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {assign.courseOutcomes?.length > 0
                            ? `${assign.courseOutcomes.length} CO${assign.courseOutcomes.length > 1 ? 's' : ''} defined`
                            : 'No COs defined'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCOModal(assign)}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--ruet-emerald)', borderColor: 'rgba(39, 174, 96, 0.4)' }}
                        title="Edit Course Outcome titles and details"
                      >
                        <Edit3 size={13} /> {assign.courseOutcomes?.length > 0 ? 'Edit COs' : 'Add COs'}
                      </button>
                    </div>

                    {/* Side-by-side Download Excel & Word Report buttons */}
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleDownloadAssignmentReport(assign, 'excel')}
                        disabled={downloadingKey === `excel-${assign._id}`}
                        className="btn btn-outline btn-sm"
                        style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(16, 185, 129, 0.4)', color: 'var(--ruet-emerald)' }}
                      >
                        {downloadingKey === `excel-${assign._id}` ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />}
                        Download Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadAssignmentReport(assign, 'word')}
                        disabled={downloadingKey === `word-${assign._id}`}
                        className="btn btn-outline btn-sm"
                        style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(59, 130, 246, 0.45)', color: '#60A5FA' }}
                      >
                        {downloadingKey === `word-${assign._id}` ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
                        Download Word
                      </button>
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
              <h3 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Change Password</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                Update your faculty account password.
              </p>
            </div>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px' }}
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
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px' }}
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
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!teacherUser?.forcePasswordChange && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={changingPass}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={changingPass}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {changingPass ? <Loader2 size={18} className="spin" /> : <Lock size={18} />}
                  {changingPass ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Outcomes Management Modal (Title + Details) */}
      {showCOModal && selectedAssignmentForCO && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.85)', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '20px', overflowY: 'auto' }}>
          <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', borderRadius: '16px', border: '1px solid rgba(39, 174, 96, 0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(39, 174, 96, 0.15)', color: 'var(--ruet-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={22} />
                </div>
                <div>
                  <h3 className="font-display" style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
                    Edit Course Outcomes (Title &amp; Details)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '2px 0 0' }}>
                    {selectedAssignmentForCO.courseCode}: {selectedAssignmentForCO.courseName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowCOModal(false); setSelectedAssignmentForCO(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(39, 174, 96, 0.08)', border: '1px solid rgba(39, 174, 96, 0.2)', marginBottom: '18px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              💡 Edit the <strong>CO Title</strong> or <strong>CO Details / Statement</strong> below. All edits are saved directly to the database and reflected in student evaluations and reports.
            </div>

            <form onSubmit={handleSaveCOs}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {coList.map((co, index) => (
                  <div key={index} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ruet-emerald)' }}>
                        Course Outcome #{co.coNumber}
                      </span>
                      {coList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCO(index)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-danger)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`CO${co.coNumber} Title (e.g. CO${co.coNumber} or short outcome heading)`}
                        value={co.title}
                        onChange={(e) => updateCO(index, 'title', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                      />
                      <textarea
                        className="form-textarea"
                        placeholder={`CO${co.coNumber} Details / Statement (e.g. Analyze and design signal processing systems...)`}
                        value={co.description}
                        onChange={(e) => updateCO(index, 'description', e.target.value)}
                        rows={2}
                        style={{ width: '100%', padding: '9px 12px', fontSize: '0.86rem' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  onClick={addCO}
                  className="btn btn-outline btn-sm"
                  style={{ color: 'var(--ruet-emerald)', borderColor: 'rgba(39, 174, 96, 0.3)' }}
                >
                  <Plus size={14} /> Add Another Outcome
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowCOModal(false); setSelectedAssignmentForCO(null); }}
                    className="btn btn-outline btn-sm"
                    disabled={savingCO}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={savingCO}
                    style={{ background: 'var(--ruet-emerald)', borderColor: 'var(--ruet-emerald)' }}
                  >
                    {savingCO ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                    {savingCO ? 'Saving...' : 'Save Outcomes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set / Extend Deadline Modal for Teachers */}
      {selectedAssignmentForDeadline && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.85)', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '20px' }}>
          <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '480px', padding: '28px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid rgba(212, 168, 67, 0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 className="font-display" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Calendar size={18} style={{ color: 'var(--ruet-gold)' }} />
                Set / Extend Feedback Deadline
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAssignmentForDeadline(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              <strong>{selectedAssignmentForDeadline.courseCode}</strong> — {selectedAssignmentForDeadline.courseName} (Series {selectedAssignmentForDeadline.series})
            </p>

            <label className="form-label">Feedback Closing Date &amp; Time</label>
            <input
              type="datetime-local"
              className="form-input"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => applyQuickDaysExtension(3)} className="btn btn-outline btn-sm">+3 Days</button>
              <button type="button" onClick={() => applyQuickDaysExtension(7)} className="btn btn-outline btn-sm">+7 Days</button>
              <button type="button" onClick={() => applyQuickDaysExtension(14)} className="btn btn-outline btn-sm">+14 Days</button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              After the deadline passes, the review session closes automatically. Extending the deadline to a future date re-opens it immediately.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
              {selectedAssignmentForDeadline.feedbackDeadline ? (
                <button
                  type="button"
                  onClick={() => handleSaveDeadline(true)}
                  disabled={savingDeadline}
                  className="btn btn-outline btn-sm"
                  style={{ color: 'var(--text-danger)', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                >
                  Clear Deadline
                </button>
              ) : <div />}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentForDeadline(null)}
                  className="btn btn-outline btn-sm"
                  disabled={savingDeadline}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDeadline(false)}
                  disabled={savingDeadline || !deadlineInput}
                  className="btn btn-primary btn-sm"
                >
                  {savingDeadline ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                  {savingDeadline ? 'Saving...' : 'Save Deadline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
