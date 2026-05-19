import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Building2, Filter } from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './Analytics.css';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="chart-tooltip-value" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const toast = useToast();
  const [trends, setTrends] = useState([]);
  const [deptData, setDeptData] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [trendsRes, deptRes, teachersRes] = await Promise.all([
        api.get('/analytics/trends'),
        api.get('/analytics/departments'),
        api.get('/teachers'),
      ]);
      setTrends(trendsRes.data);
      setDeptData(deptRes.data);
      setTeachers(teachersRes.data.filter(t => t.totalFeedbacks > 0));
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Prepare department comparison data
  const deptCompare = deptData
    .filter(d => d.feedbackCount > 0)
    .sort((a, b) => b.avgRating - a.avgRating)
    .map(d => ({
      name: d.department.code,
      avgRating: d.avgRating,
      feedbacks: d.feedbackCount,
      teachers: d.teacherCount,
    }));

  // Top 5 teachers for radar chart comparison
  const topForRadar = teachers
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5);

  const radarData = [
    { criteria: 'Overall', ...Object.fromEntries(topForRadar.map(t => [t.name.split(' ').pop(), t.avgRating])) },
    { criteria: 'Structure', ...Object.fromEntries(topForRadar.map(t => [t.name.split(' ').pop(), t.avgStructure])) },
    { criteria: 'Delivery', ...Object.fromEntries(topForRadar.map(t => [t.name.split(' ').pop(), t.avgDelivery])) },
    { criteria: 'Duration', ...Object.fromEntries(topForRadar.map(t => [t.name.split(' ').pop(), t.avgDuration])) },
    { criteria: 'Environment', ...Object.fromEntries(topForRadar.map(t => [t.name.split(' ').pop(), t.avgEnvironment])) },
    { criteria: 'Skill', ...Object.fromEntries(topForRadar.map(t => [t.name.split(' ').pop(), t.avgSkill])) },
  ];

  const radarColors = ['#2563EB', '#059669', '#F59E0B', '#DC2626', '#8B5CF6'];

  if (loading) {
    return (
      <div className="analytics-page page-transition">
        <div className="container">
          <div className="skeleton skeleton-heading" style={{ marginBottom: 32 }} />
          <div className="charts-row">
            <div className="chart-card glass-card" style={{ height: 400 }}>
              <div className="skeleton skeleton-heading" />
              <div className="skeleton" style={{ height: 300 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page page-transition">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1 className="font-display dashboard-title">
              <BarChart3 size={28} style={{ color: 'var(--primary-color)' }} />
              Analytics
            </h1>
            <p className="dashboard-subtitle">Deep dive into feedback trends and performance</p>
          </div>
        </div>

        {/* Trends Over Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="chart-card glass-card full-width-chart"
        >
          <h3 className="chart-title">
            <TrendingUp size={18} style={{ color: 'var(--text-success)' }} />
            Rating Trends Over Time
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <YAxis domain={[0, 5]} tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="avgRating"
                name="Avg Rating"
                stroke="var(--primary-color)"
                strokeWidth={2.5}
                fill="url(#primaryGrad)"
                dot={{ fill: 'var(--primary-color)', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: 'var(--primary-color)', strokeWidth: 2, fill: '#FFFFFF' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Feedback Volume */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="chart-card glass-card full-width-chart"
          style={{ marginTop: 'var(--sp-6)' }}
        >
          <h3 className="chart-title">Feedback Volume Over Time</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="feedbackCount" name="Feedbacks" fill="var(--primary-color)" radius={[6, 6, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Department Comparison + Radar */}
        <div className="charts-row" style={{ marginTop: 'var(--sp-6)' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="chart-card glass-card"
          >
            <h3 className="chart-title">
              <Building2 size={18} style={{ color: 'var(--primary-color)' }} />
              Department Comparison
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={deptCompare} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                <YAxis domain={[0, 5]} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgRating" name="Avg Rating" fill="var(--accent-color)" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="chart-card glass-card"
          >
            <h3 className="chart-title">
              <Filter size={18} style={{ color: 'var(--accent-color)' }} />
              Top Teachers — Criteria Radar
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData} outerRadius={120}>
                <PolarGrid stroke="rgba(148,163,184,0.1)" />
                <PolarAngleAxis dataKey="criteria" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#64748B', fontSize: 10 }} />
                {topForRadar.map((t, i) => (
                  <Radar
                    key={t._id}
                    name={t.name.split(' ').pop()}
                    dataKey={t.name.split(' ').pop()}
                    stroke={radarColors[i]}
                    fill={radarColors[i]}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Top Keywords */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="chart-card glass-card full-width-chart"
          style={{ marginTop: 'var(--sp-6)' }}
        >
          <h3 className="chart-title">Department Statistics Summary</h3>
          <div className="feedback-table-wrap">
            <table className="feedback-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Code</th>
                  <th>Teachers</th>
                  <th>Feedbacks</th>
                  <th>Avg Rating</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deptData.map(d => (
                  <tr 
                    key={d.department._id} 
                    onClick={() => navigate(`/department/${d.department._id}`)}
                    className="clickable-row"
                  >
                    <td className="td-teacher">{d.department.name}</td>
                    <td><span className="badge badge-blue">{d.department.code}</span></td>
                    <td>{d.teacherCount}</td>
                    <td>{d.feedbackCount}</td>
                    <td>
                      <div className="td-rating">
                        <span style={{ color: d.avgRating >= 3.5 ? 'var(--text-success)' : d.avgRating >= 2.5 ? 'var(--accent-color)' : 'var(--text-danger)' }}>
                          ★ {d.avgRating > 0 ? d.avgRating.toFixed(1) : '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${d.feedbackCount > 5 ? 'badge-emerald' : d.feedbackCount > 0 ? 'badge-gold' : 'badge-danger'}`}>
                        {d.feedbackCount > 5 ? 'Active' : d.feedbackCount > 0 ? 'Low' : 'No Data'}
                      </span>
                    </td>
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
