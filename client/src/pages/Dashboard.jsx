import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  MessageSquare, Star, Users, Building2, TrendingUp, TrendingDown,
  ArrowUpRight, Clock, Smile, Meh, Frown, ChevronRight, Download
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './Dashboard.css';

const COLORS = ['#EF4444', '#F59E0B', '#818CF8', '#10B981', '#D4A843'];
const SENTIMENT_COLORS = { positive: '#10B981', neutral: '#818CF8', negative: '#EF4444' };

function KPICard({ icon, label, value, trend, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="kpi-card"
      style={{ '--kpi-color': color }}
    >
      <div className="kpi-header">
        <div className="kpi-icon" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
        {trend && (
          <div className={`kpi-trend ${trend > 0 ? 'trend-up' : 'trend-down'}`}>
            {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="kpi-value font-display">{value}</div>
      <div className="kpi-label">{label}</div>
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="chart-tooltip-value" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [deptAnalytics, setDeptAnalytics] = useState([]);
  const [topTeachers, setTopTeachers] = useState([]);
  const [bottomTeachers, setBottomTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [overviewRes, deptRes, topRes, bottomRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/departments'),
        api.get('/teachers/top?limit=5'),
        api.get('/teachers/bottom?limit=5'),
      ]);
      setOverview(overviewRes.data);
      setDeptAnalytics(deptRes.data);
      setTopTeachers(topRes.data);
      setBottomTeachers(bottomRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!overview?.recentFeedbacks) return;
    const headers = ['Date', 'Teacher', 'Department', 'Rating', 'Teaching', 'Communication', 'Helpfulness', 'Sentiment', 'Comment'];
    const rows = overview.recentFeedbacks.map(f => [
      new Date(f.createdAt).toLocaleDateString(),
      f.teacher?.name || '',
      f.department?.name || '',
      f.rating,
      f.teachingQuality,
      f.communication,
      f.helpfulness,
      f.sentiment,
      `"${(f.comment || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruet-feedback-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully!');
  };

  if (loading) {
    return (
      <div className="dashboard-page page-transition">
        <div className="container">
          <div className="kpi-grid">
            {[1,2,3,4].map(i => (
              <div key={i} className="kpi-card">
                <div className="skeleton skeleton-circle" />
                <div className="skeleton skeleton-heading" style={{ marginTop: 16 }} />
                <div className="skeleton skeleton-text" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const deptChartData = deptAnalytics
    .filter(d => d.feedbackCount > 0)
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 10)
    .map(d => ({
      id: d.department._id,
      name: d.department.code,
      rating: d.avgRating,
      feedbacks: d.feedbackCount,
    }));

  return (
    <div className="dashboard-page page-transition">
      <div className="container">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="font-display dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">Overview of teacher feedback analytics</p>
          </div>
          <div className="dashboard-actions">
            <button onClick={exportCSV} className="btn btn-secondary btn-sm">
              <Download size={14} />
              Export CSV
            </button>
            <Link to="/analytics" className="btn btn-primary btn-sm">
              <ArrowUpRight size={14} />
              Full Analytics
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <KPICard
            icon={<MessageSquare size={22} />}
            label="Total Feedbacks"
            value={overview?.totalFeedbacks || 0}
            color="#D4A843"
            delay={0}
          />
          <KPICard
            icon={<Star size={22} />}
            label="Average Rating"
            value={`${overview?.avgRating || 0} / 5`}
            color="#10B981"
            delay={0.1}
          />
          <KPICard
            icon={<Users size={22} />}
            label="Total Teachers"
            value={overview?.totalTeachers || 0}
            color="#818CF8"
            delay={0.2}
          />
          <KPICard
            icon={<Building2 size={22} />}
            label="Departments"
            value={overview?.totalDepartments || 0}
            color="#F43F5E"
            delay={0.3}
          />
        </div>

        {/* Charts Row */}
        <div className="charts-row">
          {/* Rating Distribution Pie */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="chart-card glass-card"
          >
            <h3 className="chart-title">Rating Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={overview?.ratingDistribution || []}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {overview?.ratingDistribution?.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {overview?.ratingDistribution?.map((item, i) => (
                <div key={i} className="legend-item">
                  <div className="legend-dot" style={{ background: COLORS[i] }} />
                  <span>{item.label}: {item.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Department Comparison Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="chart-card glass-card"
          >
            <h3 className="chart-title">Department Ratings</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} width={50} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                <Bar 
                  dataKey="rating" 
                  name="Avg Rating" 
                  fill="#D4A843" 
                  radius={[0, 6, 6, 0]} 
                  barSize={18} 
                  onClick={(data) => {
                    if (data && data.payload && data.payload.id) {
                      navigate(`/department/${data.payload.id}`);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>Click a bar to view department details</p>
          </motion.div>
        </div>

        {/* Sentiment + Top/Bottom Teachers */}
        <div className="bottom-row">
          {/* Sentiment */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="chart-card glass-card"
          >
            <h3 className="chart-title">Sentiment Analysis</h3>
            <div className="sentiment-bars">
              {Object.entries(overview?.sentimentCounts || {}).map(([key, val]) => {
                const total = Object.values(overview?.sentimentCounts || {}).reduce((s, v) => s + v, 0) || 1;
                const pct = Math.round((val / total) * 100);
                const icons = { positive: <Smile size={18} />, neutral: <Meh size={18} />, negative: <Frown size={18} /> };
                return (
                  <div key={key} className="sentiment-row">
                    <div className="sentiment-label">
                      <span style={{ color: SENTIMENT_COLORS[key] }}>{icons[key]}</span>
                      <span className="sentiment-name">{key}</span>
                    </div>
                    <div className="sentiment-bar-track">
                      <div
                        className="sentiment-bar-fill"
                        style={{ width: `${pct}%`, background: SENTIMENT_COLORS[key] }}
                      />
                    </div>
                    <span className="sentiment-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Top Teachers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="chart-card glass-card"
          >
            <h3 className="chart-title">
              <TrendingUp size={18} style={{ color: 'var(--ruet-emerald)' }} />
              Top Rated Teachers
            </h3>
            <div className="teacher-list">
              {topTeachers.map((t, i) => (
                <Link to={`/teacher/${t._id}`} key={t._id} className="teacher-list-item">
                  <div className="teacher-rank rank-top">{i + 1}</div>
                  <div className="teacher-list-info">
                    <span className="teacher-list-name">{t.name}</span>
                    <span className="teacher-list-dept">{t.department?.code}</span>
                  </div>
                  <div className="teacher-list-rating">
                    <Star size={14} style={{ color: 'var(--ruet-gold)' }} />
                    <span>{t.avgRating.toFixed(1)}</span>
                  </div>
                  <ChevronRight size={14} className="teacher-list-arrow" />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Bottom Teachers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="chart-card glass-card"
          >
            <h3 className="chart-title">
              <TrendingDown size={18} style={{ color: 'var(--text-danger)' }} />
              Needs Improvement
            </h3>
            <div className="teacher-list">
              {bottomTeachers.map((t, i) => (
                <Link to={`/teacher/${t._id}`} key={t._id} className="teacher-list-item">
                  <div className="teacher-rank rank-bottom">{i + 1}</div>
                  <div className="teacher-list-info">
                    <span className="teacher-list-name">{t.name}</span>
                    <span className="teacher-list-dept">{t.department?.code}</span>
                  </div>
                  <div className="teacher-list-rating">
                    <Star size={14} style={{ color: 'var(--text-danger)' }} />
                    <span>{t.avgRating.toFixed(1)}</span>
                  </div>
                  <ChevronRight size={14} className="teacher-list-arrow" />
                </Link>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Recent Feedbacks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="chart-card glass-card recent-feedbacks"
        >
          <h3 className="chart-title">
            <Clock size={18} style={{ color: 'var(--ruet-gold)' }} />
            Recent Feedbacks
          </h3>
          <div className="feedback-table-wrap">
            <table className="feedback-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Teacher</th>
                  <th>Dept</th>
                  <th>Rating</th>
                  <th>Sentiment</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {overview?.recentFeedbacks?.map((f) => (
                  <tr key={f._id}>
                    <td className="td-date">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="td-teacher">{f.teacher?.name || '—'}</td>
                    <td>
                      <span className="badge badge-blue">{f.department?.code || '—'}</span>
                    </td>
                    <td>
                      <div className="td-rating">
                        <Star size={12} style={{ color: 'var(--ruet-gold)' }} />
                        {f.rating}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${f.sentiment === 'positive' ? 'emerald' : f.sentiment === 'negative' ? 'danger' : 'blue'}`}>
                        {f.sentiment}
                      </span>
                    </td>
                    <td className="td-comment">{f.comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
