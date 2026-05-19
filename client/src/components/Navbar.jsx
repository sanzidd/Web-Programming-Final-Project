import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  GraduationCap, MessageSquarePlus, LayoutDashboard, 
  BarChart3, LogOut, LogIn, Menu, X 
} from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const isActive = (path) => location.pathname === path;

  const isHome = location.pathname === '/';

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : 'navbar-transparent'} ${isHome ? 'navbar-home' : 'navbar-other'}`}>
      <div className="navbar-inner container">
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo">
            <img src="/ruet-logo.png" alt="RUET Logo" style={{ height: '32px', width: 'auto' }} />
          </div>
          <div className="navbar-brand-text">
            <span className="navbar-brand-name">RUET</span>
            <span className="navbar-brand-sub">Feedback System</span>
          </div>
        </Link>

        <button 
          className="navbar-toggle" 
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          id="navbar-toggle"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={`navbar-menu ${mobileOpen ? 'navbar-menu-open' : ''}`}>
          <Link 
            to="/" 
            className={`navbar-link ${isActive('/') ? 'active' : ''}`}
            id="nav-home"
          >
            Home
          </Link>
          <Link 
            to="/feedback" 
            className={`navbar-link ${isActive('/feedback') ? 'active' : ''}`}
            id="nav-feedback"
          >
            <MessageSquarePlus size={16} />
            Give Feedback
          </Link>

          {isAuthenticated ? (
            <>
              {isAdmin && (
                <>
                  <Link 
                    to="/dashboard" 
                    className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}
                    id="nav-dashboard"
                  >
                    <LayoutDashboard size={16} />
                    Dashboard
                  </Link>
                  <Link 
                    to="/analytics" 
                    className={`navbar-link ${isActive('/analytics') ? 'active' : ''}`}
                    id="nav-analytics"
                  >
                    <BarChart3 size={16} />
                    Analytics
                  </Link>
                </>
              )}
              <button onClick={logout} className="btn btn-sm btn-outline navbar-logout" id="nav-logout">
                <LogOut size={14} />
                Logout
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to="/student/login" className="btn btn-sm btn-primary navbar-login" id="nav-student-login">
                <LogIn size={14} />
                Student Login
              </Link>
              <Link to="/login" className="btn btn-sm btn-outline navbar-login" id="nav-login">
                <LogIn size={14} />
                Admin
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
