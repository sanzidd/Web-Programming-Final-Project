import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Edit2, Building2, Mail, BookOpen, Search, Filter } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminTeachers() {
  const toast = useToast();
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterDept, setFilterDept] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    name: '',
    designation: 'Assistant Professor',
    department: '',
    email: '',
    photoUrl: '',
    courses: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teacherRes, deptRes] = await Promise.all([
        api.get('/teachers'),
        api.get('/departments')
      ]);
      setTeachers(teacherRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      toast.error('Failed to load teachers data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setIsEditing(false);
    setEditId(null);
    setForm({
      name: '',
      designation: 'Assistant Professor',
      department: departments[0]?._id || '',
      email: '',
      photoUrl: '',
      courses: ''
    });
    setShowModal(true);
  };

  const openEditModal = (teacher) => {
    setIsEditing(true);
    setEditId(teacher._id);
    setForm({
      name: teacher.name || '',
      designation: teacher.designation || 'Assistant Professor',
      department: teacher.department?._id || teacher.department || '',
      email: teacher.email || '',
      photoUrl: teacher.photoUrl || '',
      courses: Array.isArray(teacher.courses) ? teacher.courses.join(', ') : (teacher.courses || '')
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.designation || !form.department) {
      toast.error('Please fill in required fields');
      return;
    }

    const payload = {
      ...form,
      courses: form.courses ? form.courses.split(',').map(c => c.trim()).filter(Boolean) : []
    };

    try {
      if (isEditing) {
        const res = await api.put(`/teachers/${editId}`, payload);
        toast.success(res.data.message || 'Teacher updated successfully');
      } else {
        const res = await api.post('/teachers', payload);
        toast.success(res.data.message || 'Teacher created successfully');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" and all associated records?`)) return;
    try {
      await api.delete(`/teachers/${id}`);
      toast.success('Teacher deleted successfully');
      setTeachers(teachers.filter(t => t._id !== id));
    } catch (err) {
      toast.error('Failed to delete teacher');
    }
  };

  const filteredTeachers = teachers.filter(t => {
    const matchesDept = filterDept ? (t.department?._id === filterDept || t.department === filterDept) : true;
    const matchesSearch = searchQuery ? (
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.designation?.toLowerCase().includes(searchQuery.toLowerCase())
    ) : true;
    return matchesDept && matchesSearch;
  });

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Manage Faculty Members</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Add, edit, or remove teacher profiles and their assigned RUET edumails.
          </p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} />
          Add New Teacher
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '25px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '220px', background: 'rgba(255,255,255,0.04)', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search by name, designation or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.9rem' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <select 
            className="form-select" 
            value={filterDept} 
            onChange={e => setFilterDept(e.target.value)}
            style={{ width: 'auto', minWidth: '180px', padding: '8px 12px' }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d._id} value={d._id}>{d.code} - {d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading teachers...</div>
        ) : filteredTeachers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No teachers found matching your criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Teacher</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Department</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Courses</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map(t => (
                  <tr key={t._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '38px', height: '38px', borderRadius: '50%', 
                          background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.95rem', color: '#fff', flexShrink: 0 
                        }}>
                          {t.name?.charAt(0) || 'T'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{t.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ 
                        background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', 
                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 
                      }}>
                        {t.department?.code || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: t.email ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {t.email ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                          {t.email}
                        </div>
                      ) : (
                        <span style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>No edumail set</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '250px' }}>
                        {(t.courses || []).length > 0 ? t.courses.map((c, idx) => (
                          <span key={idx} style={{ 
                            background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', 
                            borderRadius: '6px', fontSize: '0.75rem' 
                          }}>
                            {c}
                          </span>
                        )) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>None</span>}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(t)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Edit Teacher"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t._id, t.name)}
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--text-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '6px 10px' }}
                          title="Delete Teacher"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card"
              style={{ width: '100%', maxWidth: '700px', padding: '30px', background: 'var(--bg-card)' }}
            >
              <h3 className="font-display" style={{ marginBottom: '20px', fontSize: '1.3rem' }}>
                {isEditing ? 'Edit Teacher Profile' : 'Create New Teacher Profile'}
              </h3>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label className="form-label">Full Name *</label>
                  <input 
                    type="text" className="form-input" placeholder="e.g. Dr. Md. Kamrul Islam"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label className="form-label">Designation *</label>
                    <select 
                      className="form-select" value={form.designation}
                      onChange={e => setForm({ ...form, designation: e.target.value })} required
                    >
                      <option value="Professor">Professor</option>
                      <option value="Professor & Head">Professor & Head</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Lecturer">Lecturer</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Department *</label>
                    <select 
                      className="form-select" value={form.department}
                      onChange={e => setForm({ ...form, department: e.target.value })} required
                    >
                      <option value="">Select Dept</option>
                      {departments.map(d => (
                        <option key={d._id} value={d._id}>{d.code} - {d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">RUET Edumail (For Teacher Login)</label>
                  <input 
                    type="email" className="form-input" placeholder="e.g. teacher@ete.ruet.ac.bd"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    If provided, a Teacher account will be linked with default password &quot;12345678&quot;.
                  </span>
                </div>

                <div>
                  <label className="form-label">Courses (Comma Separated)</label>
                  <input 
                    type="text" className="form-input" placeholder="e.g. ETE 3101, ETE 3102, EEE 2101"
                    value={form.courses} onChange={e => setForm({ ...form, courses: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '15px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    {isEditing ? 'Save Changes' : 'Create Teacher'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
