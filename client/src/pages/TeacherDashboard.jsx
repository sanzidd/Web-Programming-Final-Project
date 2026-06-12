import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  BarChart3, Star, Users, BookOpen, TrendingUp, MessageSquare,
  ThumbsUp, Minus, ThumbsDown, ChevronRight, Loader2, GraduationCap
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
  const { teacherUser, isTeacher } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isTeacher) {
      navigate('/teacher/login');
      return;
    }
    fetchDashboard();
  }, [isTeacher]);

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
              { label: 'Course Structure', value: summary.avgStructure },
              { label: 'Delivery Quality', value: summary.avgDelivery },
              { label: 'Course Duration', value: summary.avgDuration },
              { label: 'Environment', value: summary.avgEnvironment },
              { label: 'Skill Development', value: summary.avgSkill },
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
    </div>
  );
}
