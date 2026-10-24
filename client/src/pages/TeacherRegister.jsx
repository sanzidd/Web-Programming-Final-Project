import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  GraduationCap, Mail, Lock, User, Building2, BadgeCheck,
  Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound, Loader2
} from 'lucide-react';
import './TeacherRegister.css';

export default function TeacherRegister() {
  const { teacherVerify, isAuthenticated, isTeacher } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [departments, setDepartments] = useState([]);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    departmentId: '',
    designation: '',
  });

  useEffect(() => {
    if (isAuthenticated && isTeacher) {
      navigate('/teacher/dashboard');
    }
  }, [isAuthenticated, isTeacher, navigate]);

  useEffect(() => {
    api.get('/departments').then(res => setDepartments(res.data)).catch(() => {});
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.departmentId) {
      toast.error('Please select your department');
      return;
    }
    if (!form.designation) {
      toast.error('Please select your designation');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/teacher-auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        departmentId: form.departmentId,
        designation: form.designation,
      });
      
      if (res.data?.isPendingApproval) {
        toast.info(res.data.message || 'Registration submitted! Awaiting administrator approval.', { duration: 6000 });
      } else {
        toast.success(res.data?.message || 'Registration successful! You can now log in.');
      }
      navigate('/teacher/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="teacher-register-page">
      <div className="teacher-register-container">
        <div className="register-card glass-card">
          <div className="register-header">
            <div className="register-icon-wrap">
              <GraduationCap size={28} />
            </div>
            <h2 className="register-title font-display">Teacher Registration</h2>
            <p className="register-subtitle">
              Create your teacher account to access your personal feedback dashboard.
            </p>
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              lineHeight: 1.4,
              textAlign: 'left'
            }}>
              💡 <strong>Note:</strong> Faculty members with emails already listed in the RUET directory can log in immediately. If registering with a new/unlisted email, admin verification and approval will be required before you can log in.
            </div>
          </div>

          <form onSubmit={handleRegister} className="register-form">
            <div className="form-group">
              <label htmlFor="tr-name"><User size={14} /> Full Name</label>
              <input
                id="tr-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Dr. John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="tr-email"><Mail size={14} /> Email Address</label>
              <input
                id="tr-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="teacher@ruet.ac.bd"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="tr-dept"><Building2 size={14} /> Department</label>
                <select
                  id="tr-dept"
                  name="departmentId"
                  value={form.departmentId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="tr-desig"><BadgeCheck size={14} /> Designation</label>
                <select
                  id="tr-desig"
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Designation</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Professor">Professor</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="tr-pass"><Lock size={14} /> Password</label>
                <div className="input-with-icon">
                  <input
                    id="tr-pass"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="input-icon-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="tr-confirm"><Lock size={14} /> Confirm Password</label>
                <input
                  id="tr-confirm"
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg register-submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
              {loading ? 'Registering...' : 'Register as Faculty'}
            </button>
          </form>

          <div className="register-footer">
            <p>Already have an account? <Link to="/teacher/login">Login here</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
