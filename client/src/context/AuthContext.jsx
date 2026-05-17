import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ruet_token');
    const savedAdmin = localStorage.getItem('ruet_admin');
    const savedStudent = localStorage.getItem('ruet_student');
    
    if (token) {
      if (savedAdmin) setAdmin(JSON.parse(savedAdmin));
      if (savedStudent) setStudent(JSON.parse(savedStudent));
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
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setAdmin(adminData);
    setStudent(null);
    return adminData;
  };

  const studentLogin = async (roll, password) => {
    const res = await api.post('/students/login', { roll, password });
    const { token, student: studentData } = res.data;
    localStorage.setItem('ruet_token', token);
    localStorage.setItem('ruet_student', JSON.stringify(studentData));
    localStorage.removeItem('ruet_admin');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setStudent(studentData);
    setAdmin(null);
    return studentData;
  };

  const studentRegister = async (data) => {
    const res = await api.post('/students/register', data);
    const { token, student: studentData } = res.data;
    localStorage.setItem('ruet_token', token);
    localStorage.setItem('ruet_student', JSON.stringify(studentData));
    localStorage.removeItem('ruet_admin');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setStudent(studentData);
    setAdmin(null);
    return studentData;
  };

  const logout = () => {
    localStorage.removeItem('ruet_token');
    localStorage.removeItem('ruet_admin');
    localStorage.removeItem('ruet_student');
    delete api.defaults.headers.common['Authorization'];
    setAdmin(null);
    setStudent(null);
  };

  return (
    <AuthContext.Provider value={{ 
      admin, 
      student, 
      loading, 
      login, 
      studentLogin, 
      studentRegister, 
      logout, 
      isAuthenticated: !!admin || !!student,
      isAdmin: !!admin,
      isStudent: !!student
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
