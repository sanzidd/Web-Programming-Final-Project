import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GraduationCap, Mail, Lock, LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import './TeacherLogin.css';

export default function TeacherLogin() {
  const { teacherLogin, isAuthenticated, isTeacher } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isTeacher) {
      navigate('/teacher/dashboard');
    }
  }, [isAuthenticated, isTeacher, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      await teacherLogin(email, password);
      showToast('Welcome back!', 'success');
      navigate('/teacher/dashboard');
    } catch (err) {
      showToast(err.response?.data?.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="teacher-login-page">
      <div className="teacher-login-container">
        <div className="login-card glass-card">
          <div className="login-header">
            <div className="login-icon-wrap">
              <GraduationCap size={28} />
            </div>
            <h2 className="login-title font-display">Teacher Login</h2>
            <p className="login-subtitle">
              Access your personal feedback dashboard and course analytics.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="tl-email"><Mail size={14} /> Email Address</label>
              <input
                id="tl-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@ruet.ac.bd"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="tl-pass"><Lock size={14} /> Password</label>
              <div className="input-with-icon">
                <input
                  id="tl-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
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

            <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="login-footer">
            <p>Don't have an account? <Link to="/teacher/register">Register here</Link></p>
            <p className="login-alt-link">
              <Link to="/student/login">Student Login</Link> · <Link to="/login">Admin Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
