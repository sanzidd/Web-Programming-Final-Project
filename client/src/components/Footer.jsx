import { Heart, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Footer.css';

export default function Footer() {
  const { isStudent } = useAuth();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo-wrap">
              <div className="footer-logo">
                <img src="/ruet-logo.png" alt="Department Logo" style={{ height: '36px', width: 'auto' }} />
              </div>
              <div>
                <h3 className="footer-title">Student Feedback</h3>
                <p className="footer-subtitle">Department of Electronics and Telecommunication Engineering</p>
              </div>
            </div>
            <p className="footer-desc">
              Empowering students to share honest feedback and helping educators 
              improve teaching quality in the Department of Electronics and Telecommunication Engineering.
            </p>
          </div>

          <div className="footer-links-section">
            <h4 className="footer-heading">Quick Links</h4>
            <Link to="/" className="footer-link">Home</Link>
            <Link to="/feedback" className="footer-link">Give Feedback</Link>
            {!isStudent && <Link to="/login" className="footer-link">Admin Panel</Link>}
          </div>

          <div className="footer-links-section">
            <h4 className="footer-heading">Contact</h4>
            <div className="footer-contact-item">
              <MapPin size={14} />
              <span>Rajshahi-6204, Bangladesh</span>
            </div>
            <div className="footer-contact-item">
              <Mail size={14} />
              <span>feedback@ruet.ac.bd</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Student Feedback — Department of Electronics and Telecommunication Engineering. Made with{' '}
            <Heart size={14} className="footer-heart" /> for ETE.
          </p>
          <p className="footer-tech">
            Built with React + Node.js + MongoDB
          </p>
        </div>
      </div>
    </footer>
  );
}
