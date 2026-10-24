import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  KeyRound, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, 
  CheckCircle2, Loader2, ShieldCheck 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') || 'student';

  const [role, setRole] = useState(initialRole); // 'student' | 'teacher' | 'admin'
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const toast = useToast();
  const navigate = useNavigate();

  // 1. Request OTP
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/password-reset/request', { email, role });
      toast.success(res.data.message || 'Verification code sent!');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length !== 6) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/password-reset/verify', { email, role, code });
      toast.success('Code verified successfully');
      setResetToken(res.data.resetToken);
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  // 3. Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/password-reset/reset', { resetToken, newPassword });
      toast.success(res.data.message || 'Password reset successfully!');
      setStep(4);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const getLoginRoute = () => {
    if (role === 'teacher') return '/teacher/login';
    if (role === 'admin') return '/login';
    return '/student/login';
  };

  return (
    <div className="forgot-pwd-page page-transition">
      <div className="forgot-pwd-container">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="forgot-pwd-card glass-card"
        >
          {/* Header */}
          <div className="forgot-pwd-header">
            <div className={`forgot-pwd-icon ${step === 4 ? 'success' : ''}`}>
              {step === 4 ? <CheckCircle2 size={30} /> : <KeyRound size={28} />}
            </div>
            <h1 className="forgot-pwd-title font-display">
              {step === 1 && 'Reset Password'}
              {step === 2 && 'Verify Security Code'}
              {step === 3 && 'Create New Password'}
              {step === 4 && 'Password Updated!'}
            </h1>
            <p className="forgot-pwd-desc">
              {step === 1 && 'Select your account type and enter your registered email to receive an OTP verification code.'}
              {step === 2 && `Enter the 6-digit code sent to ${email}`}
              {step === 3 && 'Choose a secure new password for your account.'}
              {step === 4 && 'Your password has been changed successfully. You can now log in.'}
            </p>
          </div>

          {/* Role Tabs (only on step 1) */}
          {step === 1 && (
            <div className="role-tabs">
              <button
                type="button"
                className={`role-tab-btn ${role === 'student' ? 'active' : ''}`}
                onClick={() => setRole('student')}
              >
                Student
              </button>
              <button
                type="button"
                className={`role-tab-btn ${role === 'teacher' ? 'active' : ''}`}
                onClick={() => setRole('teacher')}
              >
                Teacher
              </button>
              <button
                type="button"
                className={`role-tab-btn ${role === 'admin' ? 'active' : ''}`}
                onClick={() => setRole('admin')}
              >
                Admin
              </button>
            </div>
          )}

          {/* Step 1: Request Code Form */}
          {step === 1 && (
            <form onSubmit={handleRequestOTP} className="forgot-pwd-form">
              <div className="form-group">
                <label className="form-label">
                  <Mail size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  Registered Email Address
                </label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. name@ruet.ac.bd"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
                {loading ? 'Sending Verification Code...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* Step 2: Verify Code Form */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="forgot-pwd-form">
              <div className="form-group">
                <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="form-input code-box-input"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="button"
                  className="resend-code-btn"
                  style={{ background: 'none', border: 'none', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={handleRequestOTP}
                  disabled={loading}
                >
                  Resend Code
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Set New Password Form */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="forgot-pwd-form">
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
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
                <label className="form-label">Confirm New Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
                {loading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          )}

          {/* Step 4: Success Message */}
          {step === 4 && (
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button 
                onClick={() => navigate(getLoginRoute())}
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
              >
                Proceed to Login <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Footer Back to Login */}
          <div className="forgot-pwd-footer">
            Remember your password?{' '}
            <Link to={getLoginRoute()}>
              Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
