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
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = register form, 2 = verify code
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [verifyEmail, setVerifyEmail] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    departmentId: '',
    designation: '',
  });
  const [code, setCode] = useState('');
  const [fallbackCode, setFallbackCode] = useState('');

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

  // Step 1: Submit registration
  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (form.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/teacher-auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        departmentId: form.departmentId || undefined,
        designation: form.designation,
      });
      setVerifyEmail(res.data.email);
      
      // If email service failed, the server returns the code directly
      if (res.data.verificationCode) {
        setFallbackCode(res.data.verificationCode);
        setCode(res.data.verificationCode);
        showToast('Code generated! Enter it below to verify.', 'success');
      } else {
        showToast('Verification code sent to your email!', 'success');
      }
      setStep(2);
    } catch (err) {
      showToast(err.response?.data?.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code
  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      showToast('Please enter the 6-digit code', 'error');
      return;
    }

    setLoading(true);
    try {
      await teacherVerify(verifyEmail, code);
      showToast('Email verified! Welcome to your dashboard.', 'success');
      navigate('/teacher/dashboard');
    } catch (err) {
      showToast(err.response?.data?.message || 'Verification failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="teacher-register-page">
      <div className="teacher-register-container">
        {/* Progress indicator */}
        <div className="register-steps">
          <div className={`register-step ${step >= 1 ? 'active' : ''}`}>
            <div className="step-circle">1</div>
            <span>Register</span>
          </div>
          <div className="step-connector" />
          <div className={`register-step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-circle">2</div>
            <span>Verify Email</span>
          </div>
        </div>

        <div className="register-card glass-card">
          {step === 1 ? (
            <>
              <div className="register-header">
                <div className="register-icon-wrap">
                  <GraduationCap size={28} />
                </div>
                <h2 className="register-title font-display">Teacher Registration</h2>
                <p className="register-subtitle">
                  Create your teacher account to access your personal feedback dashboard.
                </p>
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
                    >
                      <option value="">Select Designation</option>
                      <option value="Lecturer">Lecturer</option>
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Professor">Professor</option>
                    </select>
                  </div>
                </div>

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

                <button type="submit" className="btn btn-primary btn-lg register-submit" disabled={loading}>
                  {loading ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
                  {loading ? 'Sending Code...' : 'Register & Get Code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="register-header">
                <div className="register-icon-wrap verify-icon">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="register-title font-display">Verify Your Email</h2>
                <p className="register-subtitle">
                  {fallbackCode 
                    ? <>Your verification code is shown below. Enter it to complete registration.</>
                    : <>We sent a 6-digit verification code to <strong>{verifyEmail}</strong>. Please check your inbox (and spam folder).</>
                  }
                </p>
              </div>

              {fallbackCode && (
                <div className="fallback-code-banner">
                  <div className="fallback-code-label">Your Verification Code</div>
                  <div className="fallback-code-value">{fallbackCode}</div>
                  <div className="fallback-code-hint">This code is auto-filled below. Click "Verify & Continue".</div>
                </div>
              )}

              <form onSubmit={handleVerify} className="register-form">
                <div className="form-group">
                  <label htmlFor="tr-code"><KeyRound size={14} /> Verification Code</label>
                  <input
                    id="tr-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="code-input"
                    autoFocus
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-lg register-submit" disabled={loading}>
                  {loading ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>

                <button 
                  type="button" 
                  className="btn btn-ghost resend-btn"
                  onClick={() => setStep(1)}
                >
                  Didn't receive? Go back & resend
                </button>
              </form>
            </>
          )}

          <div className="register-footer">
            <p>Already have an account? <Link to="/teacher/login">Login here</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
