/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Star, ArrowLeft, MessageSquare, BookOpen, Mail, TrendingUp, Smile, Meh, Frown, Download } from 'lucide-react';
import { LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import './TeacherProfile.css';

const SENTIMENT_ICONS = { positive: <Smile size={14} />, neutral: <Meh size={14} />, negative: <Frown size={14} /> };

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="chart-tooltip-value" style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</p>
      ))}
    </div>
  );
}

export default function TeacherProfile() {
  const { id } = useParams();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/analytics/teacher/${id}`).then(r => setData(r.data)).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id]);

  const handleExportCSV = () => {
    if (!data) return;
    
    const { teacher, feedbacks } = data;
    
    // Construct CSV content
    const csvRows = [];
    
    // 1. Title/Header
    csvRows.push(`"RUET Teacher Feedback Analytics Report - ${teacher.name.replace(/"/g, '""')}"`);
    csvRows.push(`"Generated On:","${new Date().toLocaleString()}"`);
    csvRows.push('');
    
    // 2. Teacher Summary Stats
    csvRows.push('"Teacher Profile Summary"');
    csvRows.push(`"Name","${teacher.name.replace(/"/g, '""')}"`);
    csvRows.push(`"Designation","${teacher.designation.replace(/"/g, '""')}"`);
    csvRows.push(`"Department","${(teacher.department?.name || '').replace(/"/g, '""')}"`);
    csvRows.push(`"Email","${(teacher.email || '').replace(/"/g, '""')}"`);
    csvRows.push(`"Total Feedbacks","${teacher.totalFeedbacks}"`);
    csvRows.push(`"Average Overall Rating","${teacher.avgRating.toFixed(2)}"`);
    csvRows.push(`"Average Structure Rating","${(teacher.avgStructure || 0).toFixed(2)}"`);
    csvRows.push(`"Average Delivery Rating","${(teacher.avgDelivery || 0).toFixed(2)}"`);
    csvRows.push(`"Average Duration Rating","${(teacher.avgDuration || 0).toFixed(2)}"`);
    csvRows.push(`"Average Environment Rating","${(teacher.avgEnvironment || 0).toFixed(2)}"`);
    csvRows.push(`"Average Skill Rating","${(teacher.avgSkill || 0).toFixed(2)}"`);
    csvRows.push('');
    
    // 3. Detailed Feedback Headings
    csvRows.push('"Detailed Feedback Records"');
    const headers = [
      'Date',
      'Course Name',
      'Overall Rating',
      'Structure',
      'Delivery',
      'Duration',
      'Environment',
      'Skill',
      'Sentiment',
      'General Comment',
      'Overall Feedback Comment'
    ];
    csvRows.push(headers.map(h => `"${h}"`).join(','));
    
    // 4. Detailed Feedback Rows
    feedbacks.forEach(f => {
      const date = new Date(f.createdAt).toLocaleDateString();
      const course = f.courseName || '';
      const overall = f.courseRating?.overall || '';
      const structure = f.courseRating?.structure || '';
      const delivery = f.courseRating?.delivery || '';
      const duration = f.courseRating?.duration || '';
      const environment = f.courseRating?.environment || '';
      const skill = f.courseRating?.skill || '';
      const sentiment = f.sentiment || '';
      const ratingComment = f.courseRating?.comment || '';
      const overallComment = f.overallFeedback || '';
      
      const row = [
        date,
        course,
        overall,
        structure,
        delivery,
        duration,
        environment,
        skill,
        sentiment,
        ratingComment,
        overallComment
      ];
      
      csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
    });
    
    // Create Blob and download
    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add UTF-8 BOM for Excel formatting
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = `${teacher.name.replace(/\s+/g, '_')}_Analytics_Report.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV exported successfully!');
  };

  if (loading || !data) return <div className="teacher-profile-page page-transition"><div className="container container-sm"><div className="skeleton skeleton-heading" /><div className="skeleton" style={{ height: 200 }} /></div></div>;

  const { teacher, feedbacks, trends, criteriaRadar, ratingDistribution } = data;

  return (
    <div className="teacher-profile-page page-transition">
      <div className="container">
        <div className="profile-header-actions">
          <Link to="/dashboard" className="back-link" style={{ marginBottom: 0 }}><ArrowLeft size={18} /> Back to Dashboard</Link>
          {isAdmin && (
            <button className="btn btn-outline" onClick={handleExportCSV}>
              <Download size={16} /> Export CSV
            </button>
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="teacher-header-card glass-card">
          <div className="teacher-avatar-lg"><User size={40} /></div>
          <div className="teacher-header-info">
            <h1 className="font-display teacher-name">{teacher.name}</h1>
            <p className="teacher-designation">{teacher.designation}</p>
            <div className="teacher-meta">
              <span className="badge badge-blue"><BookOpen size={12} /> {teacher.department?.name}</span>
              {teacher.email && <span className="teacher-email"><Mail size={14} /> {teacher.email}</span>}
            </div>
            <div className="teacher-courses-list">{teacher.courses?.map((c, i) => <span key={i} className="badge badge-gold">{c}</span>)}</div>
          </div>
          <div className="teacher-header-stats">
            <div className="teacher-stat-big"><Star size={28} style={{ color: 'var(--accent-color)' }} /><span className="font-display">{teacher.avgRating.toFixed(1)}</span><span className="teacher-stat-label">/ 5.0</span></div>
            <span className="teacher-stat-sub">{teacher.totalFeedbacks} feedbacks</span>
          </div>
        </motion.div>

        <div className="charts-row" style={{ marginTop: 'var(--sp-6)' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="chart-card glass-card">
            <h3 className="chart-title">Rating Breakdown</h3>
            <div className="criteria-list">
              {[
                { label: 'Overall', value: teacher.avgRating || 0, emoji: '⭐' },
                { label: 'Course Content', value: teacher.avgCourseContent || 0, emoji: '📚' },
                { label: 'Teaching-Learning', value: teacher.avgTeachingLearning || 0, emoji: '🗣️' },
                { label: 'Facilities', value: teacher.avgFacilities || 0, emoji: '🏫' },
                { label: 'CO Attainment', value: teacher.avgCOAttainment || 0, emoji: '🎯' }
              ].map((c, i) => (
                <div key={i} className="criteria-row">
                  <span className="criteria-emoji">{c.emoji}</span>
                  <span className="criteria-label">{c.label}</span>
                  <div className="criteria-bar-track"><div className="criteria-bar-fill" style={{ width: `${((c.value || 0) / 5) * 100}%` }} /></div>
                  <span className="criteria-value">{(c.value || 0).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="chart-card glass-card">
            <h3 className="chart-title">Performance Radar</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={criteriaRadar} outerRadius={100}>
                <PolarGrid stroke="rgba(148,163,184,0.1)" />
                <PolarAngleAxis dataKey="criteria" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#64748B', fontSize: 10 }} />
                <Radar name="Score" dataKey="value" stroke="var(--primary-color)" fill="var(--primary-color)" fillOpacity={0.2} strokeWidth={2} dot={{ fill: 'var(--primary-color)', r: 4 }} />
                <Tooltip content={<ChartTip />} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <div className="charts-row" style={{ marginTop: 'var(--sp-6)' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="chart-card glass-card">
            <h3 className="chart-title"><TrendingUp size={18} style={{ color: 'var(--text-success)' }} /> Rating Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="avgRating" name="Avg Rating" stroke="var(--accent-color)" strokeWidth={2.5} dot={{ fill: 'var(--accent-color)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="chart-card glass-card">
            <h3 className="chart-title">Rating Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ratingDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="rating" tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={v => `${v}★`} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="Count" fill="var(--primary-color)" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="chart-card glass-card" style={{ marginTop: 'var(--sp-6)' }}>
          <h3 className="chart-title"><MessageSquare size={18} style={{ color: 'var(--accent-color)' }} /> All Feedback ({feedbacks.length})</h3>
          <div className="feedback-comments-list">
            {feedbacks.map(f => (
              <div key={f._id} className="feedback-comment-card">
                <div className="feedback-comment-header">
                  <StarRating value={f.rating} readonly size={16} />
                  <span className={`badge badge-${f.sentiment === 'positive' ? 'emerald' : f.sentiment === 'negative' ? 'danger' : 'blue'}`}>{SENTIMENT_ICONS[f.sentiment]} {f.sentiment}</span>
                  <span className="feedback-date">{new Date(f.createdAt).toLocaleDateString()}</span>
                </div>
                {f.comment ? <p className="feedback-comment-text">"{f.comment}"</p> : <p className="feedback-no-comment">No comment</p>}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
