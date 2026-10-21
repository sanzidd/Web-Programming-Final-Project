import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, GraduationCap, Mail, Hash, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import './Login.css';

export default function StudentRegister() {
  const navigate = useNavigate();
  const { studentRegister } = useAuth();
  const toast = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    roll: '',
    email: '',
    series: '',
    departmentId: '',
    password: '',
    confirmPassword: ''
  });
  
  const [departments, setDepartments] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        // Silently fail — departments will be empty but page won't crash
        console.warn('Failed to load departments:', err.message);
      }
    };
    fetchDepartments();
  }, []);

  // Dynamic series: (currentYear - 6) to (currentYear + 1)
  const seriesOptions = (() => {
    const currentYear = new Date().getFullYear();
    const startSeries = currentYear - 6;
    const endSeries = currentYear + 1;
    const options = [];
    for (let y = startSeries; y <= endSeries; y++) {
      options.push(String(y).slice(-2));
    }
    return options;
  })();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'roll') {
      const updates = { roll: value };
      if (value.length >= 2) {
        const prefix = value.substring(0, 2);
        if (seriesOptions.includes(prefix)) {
          updates.series = prefix;
        }
      }
      setFormData(prev => ({ ...prev, ...updates }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, roll, email, password, confirmPassword, departmentId } = formData;
    
    if (!name || !roll || !email || !password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!departmentId) {
      toast.error('Please select your department');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await studentRegister({
        name,
        roll,
        email,
        series: formData.series || (roll.length >= 2 ? roll.substring(0, 2) : ''),
        departmentId: formData.departmentId,
        password
      });
      toast.success('Registration successful! Welcome to the platform.');
      navigate('/student/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
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
        style={{ maxWidth: '500px', margin: '40px auto' }}
      >
        <div className="login-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <GraduationCap size={32} />
        </div>
        <h1 className="font-display login-title">Student Registration</h1>
        <p className="login-subtitle">Create your account to submit feedback</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                type="text"
                name="name"
                className="form-input"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="register-two-col">
            <div className="form-group">
              <label className="form-label">Roll Number</label>
              <div className="input-with-icon">
                <Hash size={18} className="input-icon" />
                <input
                  type="text"
                  name="roll"
                  className="form-input"
                  placeholder="e.g. 1903001"
                  value={formData.roll}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Series *</label>
              <div className="input-with-icon">
                <Hash size={18} className="input-icon" style={{ zIndex: 2, color: '#334155' }} />
                <select
                  name="series"
                  className="form-input form-select"
                  value={formData.series}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Series</option>
                  {seriesOptions.map(s => (
                    <option key={s} value={s}>Series {s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="student@ruet.ac.bd"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

        <div className="form-group">
          <label className="form-label">Department *</label>
          <div className="input-with-icon">
            <BookOpen size={18} className="input-icon" style={{ zIndex: 2, color: '#334155' }} />
            <select
              name="departmentId"
              className="form-input form-select"
              value={formData.departmentId}
              onChange={handleChange}
              required
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept._id} value={dept._id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="register-two-col">
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="form-input"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
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

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                className="form-input"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg login-btn"
          disabled={loading}
          style={{ marginTop: '12px' }}
        >
          {loading ? 'Registering...' : 'Register as Student'}
        </button>
        </form>

        <div className="login-hint" style={{ marginTop: '20px', textAlign: 'center' }}>
          <p>Already have an account? <Link to="/student/login" className="theme-link" style={{ fontWeight: 600 }}>Sign In here</Link></p>
        </div>
      </motion.div>
    </div>
  );
}
