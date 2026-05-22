/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, MessageSquare, Star, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './DepartmentProfile.css';

function KPICard({ icon, label, value, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="kpi-card glass-card"
    >
      <div className="kpi-header">
        <div className="kpi-icon" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
      </div>
      <div className="kpi-value font-display">{value}</div>
      <div className="kpi-label">{label}</div>
    </motion.div>
  );
}

export default function DepartmentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [data, setData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartmentData = async () => {
    try {
      const [deptRes, teachersRes] = await Promise.all([
        api.get(`/analytics/departments/${id}`),
        api.get(`/teachers?department=${id}`)
      ]);
      
      setData(deptRes.data);
      // Sort teachers by rating descending
      const sortedTeachers = teachersRes.data.sort((a, b) => b.avgRating - a.avgRating);
      setTeachers(sortedTeachers);
    } catch {
      toast.error('Failed to load department analytics');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentData();
  }, [id]);

  if (loading || !data) {
    return (
      <div className="department-profile-page page-transition">
        <div className="container">
          <div className="skeleton skeleton-heading" style={{ width: 300, marginBottom: 32 }} />
          <div className="kpi-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="kpi-card glass-card">
                <div className="skeleton skeleton-circle" />
                <div className="skeleton skeleton-text" style={{ marginTop: 16 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { department, feedbackCount, teacherCount, avgRating } = data;

  return (
    <div className="department-profile-page page-transition">
      <div className="container">
        
        <button className="back-button" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--sp-6)' }}>
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="dept-header">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="dept-title-wrap">
              <h1 className="font-display dashboard-title" style={{ marginBottom: 0 }}>
                {department.name}
              </h1>
              <span className="dept-code-badge">{department.code}</span>
            </div>
            <p className="dashboard-subtitle">Department Analytics & Faculty Performance</p>
          </motion.div>
        </div>

        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <KPICard
            icon={<Users size={22} />}
            label="Total Faculty"
            value={teacherCount}
            color="#818CF8"
            delay={0.1}
          />
          <KPICard
            icon={<MessageSquare size={22} />}
            label="Total Feedbacks"
            value={feedbackCount}
            color="#D4A843"
            delay={0.2}
          />
          <KPICard
            icon={<Star size={22} />}
            label="Average Rating"
            value={`${avgRating.toFixed(1)} / 5`}
            color={avgRating >= 3.5 ? '#10B981' : avgRating >= 2.5 ? '#F59E0B' : '#EF4444'}
            delay={0.3}
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ marginTop: 'var(--sp-12)' }}
        >
          <h2 className="font-display" style={{ fontSize: '1.5rem', marginBottom: 'var(--sp-2)' }}>Faculty Members</h2>
          <p className="text-secondary">Click on a teacher to view their detailed feedback profile.</p>

          <div className="teachers-grid">
            {teachers.map((teacher, index) => {
              const ratingClass = teacher.avgRating >= 3.5 ? 'rating-high' : teacher.avgRating >= 2.5 ? 'rating-med' : 'rating-low';
              
              return (
                <motion.div
                  key={teacher._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index }}
                  className="teacher-card glass-card"
                >
                  <div className="teacher-card-header">
                    <div className="teacher-avatar">
                      {teacher.name.charAt(0)}
                    </div>
                    <div className={`teacher-rating-badge ${ratingClass}`}>
                      <Star size={14} fill="currentColor" />
                      {teacher.avgRating > 0 ? teacher.avgRating.toFixed(1) : 'New'}
                    </div>
                  </div>

                  <div className="teacher-info">
                    <h3>{teacher.name}</h3>
                    <p>{teacher.designation}</p>
                  </div>

                  <div className="teacher-stats-row">
                    <div className="stat-item">
                      <span className="stat-val">{teacher.totalFeedbacks}</span>
                      <span className="stat-lbl">Reviews</span>
                    </div>
                  </div>

                  <Link to={`/teacher/${teacher._id}`} className="view-profile-btn">
                    View Full Profile
                    <ArrowRight size={16} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
