import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  GraduationCap, BookOpen, User, CheckCircle2, Clock, 
  Search, ArrowRight, ShieldAlert, Target, Building2,
  Calendar, Layers, Sparkles
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
          <button 
            onClick={() => navigate('/feedback')}
            className="btn btn-primary"
            style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>Submit Feedback</span>
            <ArrowRight size={16} />
          </button>
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
    </div>
  );
}
