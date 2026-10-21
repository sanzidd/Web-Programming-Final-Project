import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import FeedbackForm from './pages/FeedbackForm';
import Login from './pages/Login';
import StudentLogin from './pages/StudentLogin';
import StudentRegister from './pages/StudentRegister';
import StudentDashboard from './pages/StudentDashboard';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import TeacherProfile from './pages/TeacherProfile';
import DepartmentProfile from './pages/DepartmentProfile';
import TeacherRegister from './pages/TeacherRegister';
import TeacherLogin from './pages/TeacherLogin';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherCourseFeedback from './pages/TeacherCourseFeedback';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <ThemeProvider>
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
              <Route path="/student/dashboard" element={
                <ProtectedRoute requireStudent><StudentDashboard /></ProtectedRoute>
              } />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/teacher/register" element={<TeacherRegister />} />
              <Route path="/teacher/login" element={<TeacherLogin />} />
              <Route path="/teacher/dashboard" element={
                <ProtectedRoute requireTeacher><TeacherDashboard /></ProtectedRoute>
              } />
              <Route path="/teacher/course/:courseName" element={
                <ProtectedRoute requireTeacher><TeacherCourseFeedback /></ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute requireAdmin><Analytics /></ProtectedRoute>
              } />
              <Route path="/teacher/:id" element={
                <ProtectedRoute requireAdmin><TeacherProfile /></ProtectedRoute>
              } />
              <Route path="/department/:id" element={
                <ProtectedRoute requireAdmin><DepartmentProfile /></ProtectedRoute>
              } />
            </Routes>
          </main>
          <Footer />
        </Router>
      </ToastProvider>
    </AuthProvider>
  </ThemeProvider>
  );
}

export default App;
