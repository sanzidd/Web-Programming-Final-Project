import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin, requireTeacher, requireStudent }) {
  const { isAuthenticated, isAdmin, isTeacher, isStudent, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '60vh' 
      }}>
        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireTeacher && !isTeacher) {
    return <Navigate to="/" replace />;
  }

  if (requireStudent && !isStudent) {
    return <Navigate to="/student/login" replace />;
  }

  return children;
}
