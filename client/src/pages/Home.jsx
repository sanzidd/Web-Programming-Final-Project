import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  MessageSquarePlus, Shield, BarChart3, Users, Star, 
  Building2, ChevronRight, Sparkles, Lock, Eye, TrendingUp,
  GraduationCap, Award, Zap
} from 'lucide-react';
import api from '../services/api';
import './Home.css';

function CountUpNumber({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const start = 0;
          const startTime = Date.now();
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * (end - start) + start));
            if (progress < 1) requestAnimationFrame(animate);
          };
          animate();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export default function Home() {
  const [stats, setStats] = useState({ feedbacks: 0, teachers: 0, departments: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [depts, teachers] = await Promise.all([
          api.get('/departments'),
          api.get('/teachers'),
        ]);
        setStats({
          departments: depts.data.length,
          teachers: teachers.data.length,
          feedbacks: teachers.data.reduce((sum, t) => sum + t.totalFeedbacks, 0),
        });
      } catch (err) {
        // Fallback stats
        setStats({ departments: 18, teachers: 45, feedbacks: 200 });
      }
    };
    fetchStats();
  }, []);

  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let width = canvas.width = canvas.parentElement.offsetWidth;
    let height = canvas.height = canvas.parentElement.offsetHeight;
    
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    };
    window.addEventListener('resize', handleResize);
    
    const particleCount = Math.min(100, Math.floor((width * height) / 12000));
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        radius: Math.random() * 2 + 1,
        color: Math.random() > 0.5 ? 'rgba(225, 29, 72, 0.45)' : 'rgba(234, 179, 8, 0.4)'
      });
    }
    
    // Track mouse coordinates for interactive mouse line attraction
    let mouse = { x: null, y: null };
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };
    
    canvas.parentElement.addEventListener('mousemove', handleMouseMove);
    canvas.parentElement.addEventListener('mouseleave', handleMouseLeave);
    
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Update and draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });
      
      // Draw lines
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        
        // Connect to mouse if close
        if (mouse.x !== null && mouse.y !== null) {
          const distToMouse = Math.hypot(p1.x - mouse.x, p1.y - mouse.y);
          if (distToMouse < 120) {
            const alpha = (1 - distToMouse / 120) * 0.25;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(234, 179, 8, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          
          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.18;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(225, 29, 72, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      
      animationFrameId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (canvas && canvas.parentElement) {
        canvas.parentElement.removeEventListener('mousemove', handleMouseMove);
        canvas.parentElement.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-canvas-container">
          <canvas ref={canvasRef} className="hero-canvas" />
          <div className="hero-canvas-overlay" />
        </div>

        <div className="hero-bg-effects">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
          <div className="hero-grid-pattern" />
        </div>

        <div className="container hero-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="hero-text"
          >
            <div className="hero-badge">
              <Sparkles size={14} />
              <span>Anonymous & Secure</span>
            </div>
            <h1 className="hero-title font-display">
              Shape the Future of{' '}
              <span className="text-gradient">Education</span>{' '}
              at RUET
            </h1>
            <p className="hero-subtitle">
              Your voice matters. Share honest, anonymous feedback about your teachers 
              and help improve the quality of education at Rajshahi University of 
              Engineering & Technology.
            </p>
            <div className="hero-actions">
              <Link to="/feedback" className="btn btn-primary btn-lg" id="hero-cta">
                <MessageSquarePlus size={20} />
                Give Feedback
                <ChevronRight size={18} />
              </Link>
              <Link to="/login" className="btn btn-glass btn-lg" id="hero-admin">
                <BarChart3 size={18} />
                Admin Panel
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hero-visual"
          >
            <div className="hero-card-stack">
              <div className="hero-floating-card card-1">
                <Star size={20} className="hero-card-icon gold" />
                <div>
                  <span className="hero-card-value">4.8</span>
                  <span className="hero-card-label">Avg Rating</span>
                </div>
              </div>
              <div className="hero-floating-card card-2">
                <Shield size={20} className="hero-card-icon emerald" />
                <div>
                  <span className="hero-card-value">100%</span>
                  <span className="hero-card-label">Anonymous</span>
                </div>
              </div>
              <div className="hero-floating-card card-3">
                <TrendingUp size={20} className="hero-card-icon blue" />
                <div>
                  <span className="hero-card-value">Live</span>
                  <span className="hero-card-label">Analytics</span>
                </div>
              </div>
              <div className="hero-central-graphic">
                <img src="/ruet-logo.png" alt="RUET Logo" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: 'var(--ruet-gold-dim)' }}>
                <MessageSquarePlus size={24} style={{ color: 'var(--ruet-gold)' }} />
              </div>
              <div className="stat-value font-display">
                <CountUpNumber end={stats.feedbacks} suffix="+" />
              </div>
              <div className="stat-label">Feedbacks Received</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: 'var(--ruet-emerald-dim)' }}>
                <Users size={24} style={{ color: 'var(--ruet-emerald)' }} />
              </div>
              <div className="stat-value font-display">
                <CountUpNumber end={stats.teachers} suffix="+" />
              </div>
              <div className="stat-label">Teachers Listed</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                <Building2 size={24} style={{ color: '#818CF8' }} />
              </div>
              <div className="stat-value font-display">
                <CountUpNumber end={stats.departments} />
              </div>
              <div className="stat-label">Departments</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)' }}>
                <Star size={24} style={{ color: '#F43F5E' }} />
              </div>
              <div className="stat-value font-display">
                <CountUpNumber end={4} suffix="/5" />
              </div>
              <div className="stat-label">Avg Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section how-it-works">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-header"
          >
            <span className="section-badge badge badge-gold">
              <Zap size={12} />
              Simple Process
            </span>
            <h2 className="section-title font-display">
              How It <span className="text-gradient">Works</span>
            </h2>
            <p className="section-subtitle">
              Three easy steps to make your voice heard — completely anonymous.
            </p>
          </motion.div>

          <div className="steps-grid">
            {[
              {
                step: '01',
                icon: <Building2 size={28} />,
                title: 'Select Department & Teacher',
                desc: 'Choose from all 18 RUET departments and find the teacher you want to evaluate.',
                color: 'var(--ruet-gold)',
              },
              {
                step: '02',
                icon: <Star size={28} />,
                title: 'Rate & Comment',
                desc: 'Provide ratings on teaching quality, communication, helpfulness, and leave optional comments.',
                color: 'var(--ruet-emerald)',
              },
              {
                step: '03',
                icon: <BarChart3 size={28} />,
                title: 'Impact Analytics',
                desc: 'Your feedback contributes to comprehensive analytics that help improve education quality.',
                color: '#818CF8',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="step-card glass-card"
              >
                <div className="step-number" style={{ color: item.color }}>
                  {item.step}
                </div>
                <div className="step-icon" style={{ color: item.color }}>
                  {item.icon}
                </div>
                <h3 className="step-title">{item.title}</h3>
                <p className="step-desc">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="section trust-section">
        <div className="container">
          <div className="trust-grid">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="trust-content"
            >
              <span className="section-badge badge badge-emerald">
                <Lock size={12} />
                Privacy First
              </span>
              <h2 className="section-title font-display">
                Your Feedback is{' '}
                <span className="text-gradient-emerald">100% Anonymous</span>
              </h2>
              <p className="section-subtitle" style={{ textAlign: 'left' }}>
                We take your privacy seriously. No login required, no IP tracking, 
                no personal data collection. Your identity is never associated with 
                your feedback.
              </p>
              <div className="trust-features">
                {[
                  { icon: <Shield size={18} />, text: 'No login required to submit feedback' },
                  { icon: <Lock size={18} />, text: 'Zero personal data collection' },
                  { icon: <Eye size={18} />, text: 'No IP tracking or browser fingerprinting' },
                  { icon: <Award size={18} />, text: 'End-to-end anonymous submissions' },
                ].map((item, i) => (
                  <div key={i} className="trust-feature">
                    <div className="trust-feature-icon">{item.icon}</div>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
              <Link to="/feedback" className="btn btn-primary btn-lg" style={{ marginTop: '1.5rem' }}>
                <MessageSquarePlus size={18} />
                Start Giving Feedback
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="trust-visual"
            >
              <div className="trust-shield-graphic">
                <div className="shield-outer">
                  <div className="shield-inner">
                    <Shield size={48} />
                  </div>
                </div>
                <div className="shield-ring ring-1" />
                <div className="shield-ring ring-2" />
                <div className="shield-ring ring-3" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="cta-card"
          >
            <h2 className="cta-title font-display">
              Ready to Make a <span className="text-gradient">Difference</span>?
            </h2>
            <p className="cta-subtitle">
              Your honest feedback helps teachers grow and improves education for everyone at RUET.
            </p>
            <Link to="/feedback" className="btn btn-primary btn-lg">
              <MessageSquarePlus size={20} />
              Give Feedback Now
              <ChevronRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
