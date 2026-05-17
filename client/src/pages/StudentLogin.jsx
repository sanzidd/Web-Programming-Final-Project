import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, LogIn, Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './Login.css';

export default function StudentLogin() {
  const navigate = useNavigate();
  const { studentLogin } = useAuth();
  const toast = useToast();
  const [roll, setRoll] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roll || !password) {
      toast.error('Please enter both roll number and password');
      return;
    }
    setLoading(true);
    try {
      await studentLogin(roll, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page page-transition">
      <div className="login-bg-effects">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="login-card glass-card"
      >
        <div className="login-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <GraduationCap size={32} />
        </div>
        <h1 className="font-display login-title">Student Login</h1>
        <p className="login-subtitle">Sign in to submit anonymous feedback</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-roll">Roll Number</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                type="text"
                id="login-roll"
                className="form-input"
                placeholder="Enter your roll number"
                value={roll}
                onChange={e => setRoll(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg login-btn"
            disabled={loading}
          >
            {loading ? 'Signing in...' : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="login-hint" style={{ marginTop: '20px', textAlign: 'center' }}>
          <p>Don't have an account? <Link to="/student/register" style={{ color: '#3b82f6', textDecoration: 'none' }}>Register here</Link></p>
        </div>
      </motion.div>
    </div>
  );
}
