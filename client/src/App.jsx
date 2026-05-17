import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import FeedbackForm from './pages/FeedbackForm';
import Login from './pages/Login';
import StudentLogin from './pages/StudentLogin';
import StudentRegister from './pages/StudentRegister';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import TeacherProfile from './pages/TeacherProfile';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/feedback" element={<FeedbackForm />} />
              <Route path="/login" element={<Login />} />
              <Route path="/student/login" element={<StudentLogin />} />
              <Route path="/student/register" element={<StudentRegister />} />
              <Route path="/dashboard" element={
                <ProtectedRoute><Dashboard /></ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute><Analytics /></ProtectedRoute>
              } />
              <Route path="/teacher/:id" element={
                <ProtectedRoute><TeacherProfile /></ProtectedRoute>
              } />
            </Routes>
          </main>
          <Footer />
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
