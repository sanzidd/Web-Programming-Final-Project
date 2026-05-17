import { GraduationCap, Heart, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo-wrap">
              <div className="footer-logo">
                <GraduationCap size={24} />
              </div>
              <div>
                <h3 className="footer-title">RUET Feedback</h3>
                <p className="footer-subtitle">Anonymous Teacher Evaluation</p>
              </div>
            </div>
            <p className="footer-desc">
              Empowering students to share honest feedback and helping educators 
              improve teaching quality at Rajshahi University of Engineering & Technology.
            </p>
          </div>

          <div className="footer-links-section">
            <h4 className="footer-heading">Quick Links</h4>
            <Link to="/" className="footer-link">Home</Link>
            <Link to="/feedback" className="footer-link">Give Feedback</Link>
            <Link to="/login" className="footer-link">Admin Panel</Link>
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
            © {new Date().getFullYear()} RUET Teacher Feedback System. Made with{' '}
            <Heart size={14} className="footer-heart" /> for RUET.
          </p>
          <p className="footer-tech">
            Built with React + Node.js + MongoDB
          </p>
        </div>
      </div>
    </footer>
  );
}
