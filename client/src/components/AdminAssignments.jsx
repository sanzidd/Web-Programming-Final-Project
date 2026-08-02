import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Trash2, Building2, Users, Calendar, Filter, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminAssignments() {
  const toast = useToast();
  const [assignments, setAssignments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [filterSeries, setFilterSeries] = useState('');

  const [form, setForm] = useState({
    courseCode: '',
    courseName: '',
    department: '',
    semester: '1st Semester',
    series: '21',
    teacher: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignRes, deptRes, teacherRes] = await Promise.all([
        api.get('/admin/assignments'),
        api.get('/departments'),
        api.get('/teachers')
      ]);
      setAssignments(assignRes.data);
      setDepartments(deptRes.data);
      setTeachers(teacherRes.data);
    } catch (err) {
      toast.error('Failed to load course assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeptChangeInForm = (deptId) => {
    setForm(f => ({ ...f, department: deptId, teacher: '' }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.courseCode || !form.courseName || !form.department || !form.series || !form.teacher) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await api.post('/admin/assignments', form);
      toast.success('Course assignment created successfully!');
      setShowModal(false);
      setForm({
        courseCode: '',
        courseName: '',
        department: '',
        semester: '1st Semester',
        series: '21',
        teacher: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create assignment');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this course assignment?')) return;
    try {
      await api.delete(`/admin/assignments/${id}`);
      toast.success('Assignment deleted');
      setAssignments(prev => prev.filter(a => a._id !== id));
    } catch (err) {
      toast.error('Failed to delete assignment');
    }
  };

  const filteredAssignments = assignments.filter(a => {
    if (filterDept && a.department?._id !== filterDept) return false;
    if (filterSeries && a.series !== filterSeries) return false;
    return true;
  });

  const availableTeachersForForm = form.department 
    ? teachers.filter(t => t.department?._id === form.department || t.department === form.department)
    : teachers;

  return (
    <div className="admin-assignments-container" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen style={{ color: 'var(--ruet-gold)' }} />
            Course & Teacher Assignments
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Configure which student series and departments are eligible to evaluate specific courses and teachers.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} />
          Add Assignment
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '15px 20px', marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <Filter size={16} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Filter By:</span>
        </div>
        <select 
          className="form-select" 
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.9rem' }}
          value={filterDept} 
          onChange={e => setFilterDept(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
          ))}
        </select>
        <select 
          className="form-select" 
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.9rem' }}
          value={filterSeries} 
          onChange={e => setFilterSeries(e.target.value)}
        >
          <option value="">All Series</option>
          <option value="20">Series 20</option>
          <option value="21">Series 21</option>
          <option value="22">Series 22</option>
          <option value="23">Series 23</option>
          <option value="all">All Series (Universal)</option>
        </select>
        {(filterDept || filterSeries) && (
          <button onClick={() => { setFilterDept(''); setFilterSeries(''); }} className="btn btn-outline btn-sm">
            Reset Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="chart-card glass-card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading course assignments...</div>
        ) : filteredAssignments.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p>No course assignments found matching criteria.</p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm" style={{ marginTop: '15px' }}>
              Create First Assignment
            </button>
          </div>
        ) : (
          <div className="feedback-table-wrap">
            <table className="feedback-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Department</th>
                  <th>Series</th>
                  <th>Semester</th>
                  <th>Assigned Teacher</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map(a => (
                  <tr key={a._id}>
                    <td style={{ fontWeight: 600, color: 'var(--ruet-gold)' }}>{a.courseCode}</td>
                    <td>{a.courseName}</td>
                    <td><span className="badge badge-blue">{a.department?.code || '—'}</span></td>
                    <td><span className="badge badge-emerald">Series {a.series}</span></td>
                    <td>{a.semester || '—'}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.teacher?.name || '—'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.teacher?.designation || ''}</div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> Active
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleDelete(a._id)}
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--text-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '6px 10px' }}
                        title="Delete Assignment"
                      >
                        <Trash2 size={14} />
                      </button>
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
              <h3 className="font-display" style={{ marginBottom: '20px', fontSize: '1.3rem' }}>Create New Course Assignment</h3>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label className="form-label">Course Code *</label>
                    <input 
                      type="text" className="form-input" placeholder="e.g. ETE 3101"
                      value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Series *</label>
                    <select 
                      className="form-select" value={form.series}
                      onChange={e => setForm({ ...form, series: e.target.value })} required
                    >
                      <option value="20">Series 20</option>
                      <option value="21">Series 21</option>
                      <option value="22">Series 22</option>
                      <option value="23">Series 23</option>
                      <option value="all">All Series (Universal)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Course Name *</label>
                  <input 
                    type="text" className="form-input" placeholder="e.g. Digital Communications"
                    value={form.courseName} onChange={e => setForm({ ...form, courseName: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label className="form-label">Department *</label>
                    <select 
                      className="form-select" value={form.department}
                      onChange={e => handleDeptChangeInForm(e.target.value)} required
                    >
                      <option value="">Select Dept...</option>
                      {departments.map(d => (
                        <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Semester *</label>
                    <select 
                      className="form-select" value={form.semester}
                      onChange={e => setForm({ ...form, semester: e.target.value })} required
                    >
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                      <option value="3rd Semester">3rd Semester</option>
                      <option value="4th Semester">4th Semester</option>
                      <option value="5th Semester">5th Semester</option>
                      <option value="6th Semester">6th Semester</option>
                      <option value="7th Semester">7th Semester</option>
                      <option value="8th Semester">8th Semester</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Assigned Teacher *</label>
                  <select 
                    className="form-select" value={form.teacher}
                    onChange={e => setForm({ ...form, teacher: e.target.value })} required
                  >
                    <option value="">Select Teacher...</option>
                    {availableTeachersForForm.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.name} — {t.designation} ({t.department?.code || ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Assignment</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
