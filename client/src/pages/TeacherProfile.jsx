import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Star, ArrowLeft, MessageSquare, BookOpen, Mail, TrendingUp, Smile, Meh, Frown } from 'lucide-react';
import { LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/analytics/teacher/${id}`).then(r => setData(r.data)).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id]);

  if (loading || !data) return <div className="teacher-profile-page page-transition"><div className="container container-sm"><div className="skeleton skeleton-heading" /><div className="skeleton" style={{ height: 200 }} /></div></div>;

  const { teacher, feedbacks, trends, criteriaRadar, ratingDistribution } = data;

  return (
    <div className="teacher-profile-page page-transition">
      <div className="container">
        <Link to="/dashboard" className="back-link"><ArrowLeft size={18} /> Back to Dashboard</Link>

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
            <div className="teacher-stat-big"><Star size={28} style={{ color: 'var(--ruet-gold)' }} /><span className="font-display">{teacher.avgRating.toFixed(1)}</span><span className="teacher-stat-label">/ 5.0</span></div>
            <span className="teacher-stat-sub">{teacher.totalFeedbacks} feedbacks</span>
          </div>
        </motion.div>

        <div className="charts-row" style={{ marginTop: 'var(--sp-6)' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="chart-card glass-card">
            <h3 className="chart-title">Rating Breakdown</h3>
            <div className="criteria-list">
              {[{ label: 'Overall', value: teacher.avgRating, emoji: '⭐' }, { label: 'Teaching', value: teacher.avgTeaching, emoji: '📚' }, { label: 'Communication', value: teacher.avgCommunication, emoji: '🗣️' }, { label: 'Helpfulness', value: teacher.avgHelpfulness, emoji: '🤝' }].map((c, i) => (
                <div key={i} className="criteria-row">
                  <span className="criteria-emoji">{c.emoji}</span>
                  <span className="criteria-label">{c.label}</span>
                  <div className="criteria-bar-track"><div className="criteria-bar-fill" style={{ width: `${(c.value / 5) * 100}%` }} /></div>
                  <span className="criteria-value">{c.value.toFixed(1)}</span>
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
                <Radar name="Score" dataKey="value" stroke="#D4A843" fill="#D4A843" fillOpacity={0.2} strokeWidth={2} dot={{ fill: '#D4A843', r: 4 }} />
                <Tooltip content={<ChartTip />} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <div className="charts-row" style={{ marginTop: 'var(--sp-6)' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="chart-card glass-card">
            <h3 className="chart-title"><TrendingUp size={18} style={{ color: 'var(--ruet-emerald)' }} /> Rating Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="avgRating" name="Avg Rating" stroke="#D4A843" strokeWidth={2.5} dot={{ fill: '#D4A843', r: 4 }} />
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
                <Bar dataKey="count" name="Count" fill="#818CF8" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="chart-card glass-card" style={{ marginTop: 'var(--sp-6)' }}>
          <h3 className="chart-title"><MessageSquare size={18} style={{ color: 'var(--ruet-gold)' }} /> All Feedback ({feedbacks.length})</h3>
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
