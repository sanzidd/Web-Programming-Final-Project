import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [student, setStudent] = useState(null);
  const [teacherUser, setTeacherUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ruet_token');
    const savedAdmin = localStorage.getItem('ruet_admin');
    const savedStudent = localStorage.getItem('ruet_student');
    const savedTeacher = localStorage.getItem('ruet_teacher');
    
    if (token) {
      if (savedAdmin) setAdmin(JSON.parse(savedAdmin));
      if (savedStudent) setStudent(JSON.parse(savedStudent));
      if (savedTeacher) setTeacherUser(JSON.parse(savedTeacher));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/admin/login', { username, password });
    const { token, admin: adminData } = res.data;
    localStorage.setItem('ruet_token', token);
    localStorage.setItem('ruet_admin', JSON.stringify(adminData));
    localStorage.removeItem('ruet_student');
    localStorage.removeItem('ruet_teacher');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setAdmin(adminData);
    setStudent(null);
    setTeacherUser(null);
    return adminData;
  };

  const studentLogin = async (roll, password) => {
    const res = await api.post('/students/login', { roll, password });
    const { token, student: studentData } = res.data;
    localStorage.setItem('ruet_token', token);
    localStorage.setItem('ruet_student', JSON.stringify(studentData));
    localStorage.removeItem('ruet_admin');
    localStorage.removeItem('ruet_teacher');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setStudent(studentData);
    setAdmin(null);
    setTeacherUser(null);
    return studentData;
  };

  const studentRegister = async (data) => {
    const res = await api.post('/students/register', data);
    const { token, student: studentData } = res.data;
    localStorage.setItem('ruet_token', token);
    localStorage.setItem('ruet_student', JSON.stringify(studentData));
    localStorage.removeItem('ruet_admin');
    localStorage.removeItem('ruet_teacher');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setStudent(studentData);
    setAdmin(null);
    setTeacherUser(null);
    return studentData;
  };

  const teacherLogin = async (email, password) => {
    const res = await api.post('/teacher-auth/login', { email, password });
    const { token, teacherUser: teacherData } = res.data;
    localStorage.setItem('ruet_token', token);
    localStorage.setItem('ruet_teacher', JSON.stringify(teacherData));
    localStorage.removeItem('ruet_admin');
    localStorage.removeItem('ruet_student');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setTeacherUser(teacherData);
    setAdmin(null);
    setStudent(null);
    return teacherData;
  };

  const teacherVerify = async (email, code) => {
    const res = await api.post('/teacher-auth/verify', { email, code });
    const { token, teacherUser: teacherData } = res.data;
    localStorage.setItem('ruet_token', token);
    localStorage.setItem('ruet_teacher', JSON.stringify(teacherData));
    localStorage.removeItem('ruet_admin');
    localStorage.removeItem('ruet_student');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setTeacherUser(teacherData);
    setAdmin(null);
    setStudent(null);
    return teacherData;
  };

  const logout = () => {
    localStorage.removeItem('ruet_token');
    localStorage.removeItem('ruet_admin');
    localStorage.removeItem('ruet_student');
    localStorage.removeItem('ruet_teacher');
    delete api.defaults.headers.common['Authorization'];
    setAdmin(null);
    setStudent(null);
    setTeacherUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      admin, 
      student, 
      teacherUser,
      loading, 
      login, 
      studentLogin, 
      studentRegister, 
      teacherLogin,
      teacherVerify,
      logout, 
      isAuthenticated: !!admin || !!student || !!teacherUser,
      isAdmin: !!admin,
      isStudent: !!student,
      isTeacher: !!teacherUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
