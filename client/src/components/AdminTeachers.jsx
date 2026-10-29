/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Plus, Trash2, Edit2, Mail, Search, 
  Filter, CheckCircle, XCircle, Key, ShieldCheck, Clock, AlertCircle, Loader2, FileSpreadsheet 
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminTeachers() {
  const toast = useToast();
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pendingTeachers, setPendingTeachers] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('directory'); // 'directory' | 'pending'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
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
      const [teacherRes, deptRes, pendingRes] = await Promise.all([
        api.get('/teachers'),
        api.get('/departments'),
        api.get('/admin/pending-teachers').catch(() => ({ data: [] }))
      ]);
      setTeachers(teacherRes.data || []);
      setDepartments(deptRes.data || []);
      setPendingTeachers(pendingRes.data || []);
    } catch {
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
        toast.success(res.data.message || 'Teacher updated successfully. Email synced everywhere!');
      } else {
        const res = await api.post('/teachers', payload);
        toast.success(res.data.message || 'Teacher created successfully and login synced!');
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
    } catch {
      toast.error('Failed to delete teacher');
    }
  };

  const handleResetPassword = async (teacherId, name) => {
    if (!window.confirm(`Reset login password for "${name}" to default "12345678"?`)) return;
    setActionLoading(`pwd-${teacherId}`);
    try {
      const res = await api.post(`/teachers/${teacherId}/reset-password`);
      toast.success(res.data.message || `Password for ${name} reset to 12345678`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadExcel = async (teacher) => {
    setActionLoading(`excel-${teacher._id}`);
    try {
      toast.info(`Generating Excel report for ${teacher.name}...`);
      const response = await api.get(`/admin/teachers/${teacher._id}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeName = (teacher.name || 'Teacher').replace(/[^a-zA-Z0-9]/g, '_');
      link.setAttribute('download', `Feedback_Report_${safeName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel report downloaded!');
    } catch {
      toast.error('Failed to download Excel report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprovePending = async (pendingId, name) => {
    setActionLoading(`approve-${pendingId}`);
    try {
      const res = await api.post(`/admin/pending-teachers/${pendingId}/approve`);
      toast.success(res.data.message || `Teacher "${name}" verified and added to main server!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve teacher');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPending = async (pendingId, name) => {
    if (!window.confirm(`Are you sure you want to reject and remove registration for "${name}"?`)) return;
    setActionLoading(`reject-${pendingId}`);
    try {
      const res = await api.delete(`/admin/pending-teachers/${pendingId}/reject`);
      toast.success(res.data.message || 'Registration rejected.');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject registration');
    } finally {
      setActionLoading(null);
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
      {/* Header & Main Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Manage Faculty Members</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Update official emails, review pending registrations, and manage faculty credentials.
          </p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} />
          Add New Teacher
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveSubTab('directory')}
          className={`btn ${activeSubTab === 'directory' ? 'btn-primary' : 'btn-outline'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem' }}
        >
          <Users size={16} />
          Faculty Directory ({teachers.length})
        </button>
        <button
          onClick={() => setActiveSubTab('pending')}
          className={`btn ${activeSubTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem',
            position: 'relative',
            borderColor: pendingTeachers.length > 0 ? 'rgba(245, 158, 11, 0.4)' : undefined
          }}
        >
          <Clock size={16} />
          Pending Approvals
          {pendingTeachers.length > 0 && (
            <span style={{ 
              background: '#f59e0b', color: '#000', fontWeight: 700, 
              fontSize: '0.75rem', padding: '1px 7px', borderRadius: '12px', marginLeft: '4px' 
            }}>
              {pendingTeachers.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════
          TAB 1: PENDING APPROVALS
      ══════════════════════════════════════════ */}
      {activeSubTab === 'pending' && (
        <div>
          <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <AlertCircle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Unknown Faculty Registrations Requiring Approval
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  When someone registers with an email that is not pre-listed in the faculty directory, their account is held here.
                  Click <strong>&quot;Verify &amp; Add to Main Server&quot;</strong> to approve them, create their official faculty profile, and grant them immediate portal access.
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading pending registrations...</div>
            ) : pendingTeachers.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center' }}>
                <ShieldCheck size={48} style={{ color: '#10b981', margin: '0 auto 15px', display: 'block' }} />
                <h3 className="font-display" style={{ fontSize: '1.2rem', marginBottom: '6px' }}>All Clear! No Pending Registrations</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
                  There are no unverified teacher registrations waiting for review. All active teacher accounts are synchronized.
                </p>
              </div>
            ) : (
              <div className="feedback-table-wrap" style={{ margin: 0 }}>
                <table className="feedback-table">
                  <thead>
                    <tr>
                      <th>Applicant Name</th>
                      <th>Registered Email</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Registration Date</th>
                      <th style={{ textAlign: 'right' }}>Admin Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTeachers.map(p => (
                      <tr key={p._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '38px', height: '38px', borderRadius: '50%', 
                              background: 'var(--grad-accent)', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '0.95rem', color: '#fff', flexShrink: 0 
                            }}>
                              {p.name?.charAt(0) || 'T'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                              <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                Awaiting Verification
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                            {p.email}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue">
                            {p.department?.code || 'N/A'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {p.designation || 'Lecturer'}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              onClick={() => handleApprovePending(p._id, p.name)}
                              disabled={actionLoading === `approve-${p._id}`}
                              className="btn btn-sm"
                              style={{ 
                                background: '#10b981', color: '#fff', border: 'none', 
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
                                fontWeight: 600
                              }}
                              title="Verify and Add to Main Server"
                            >
                              {actionLoading === `approve-${p._id}` ? (
                                <Loader2 size={14} className="spin" />
                              ) : (
                                <CheckCircle size={15} />
                              )}
                              Verify &amp; Add to Main Server
                            </button>
                            <button
                              onClick={() => handleRejectPending(p._id, p.name)}
                              disabled={actionLoading === `reject-${p._id}`}
                              className="btn btn-outline btn-sm"
                              style={{ color: 'var(--text-danger)', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '6px 10px' }}
                              title="Reject Registration"
                            >
                              {actionLoading === `reject-${p._id}` ? (
                                <Loader2 size={14} className="spin" />
                              ) : (
                                <XCircle size={15} />
                              )}
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
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 2: FACULTY DIRECTORY
      ══════════════════════════════════════════ */}
      {activeSubTab === 'directory' && (
        <div>
          {/* Filters */}
          <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '25px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '220px', background: 'var(--bg-elevated)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
              <Search size={16} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search by name, designation or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '0.9rem' }}
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
              <div className="feedback-table-wrap" style={{ margin: 0 }}>
                <table className="feedback-table">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Department</th>
                      <th>Email (Login ID)</th>
                      <th>Courses</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.map(t => (
                      <tr key={t._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '38px', height: '38px', borderRadius: '50%', 
                              background: 'var(--grad-primary)', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '0.95rem', color: '#fff', flexShrink: 0 
                            }}>
                              {t.name?.charAt(0) || 'T'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.designation}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue">
                            {t.department?.code || 'N/A'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.9rem', color: t.email ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {t.email ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                              <span style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>{t.email}</span>
                            </div>
                          ) : (
                            <span style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>No email set</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '250px' }}>
                            {(t.courses || []).length > 0 ? t.courses.map((c, idx) => (
                              <span key={idx} style={{ 
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '2px 8px', 
                                borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' 
                              }}>
                                {c}
                              </span>
                            )) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>None</span>}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleDownloadExcel(t)}
                              disabled={actionLoading === `excel-${t._id}`}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(16, 185, 129, 0.35)', color: '#10b981' }}
                              title="Download Excel Feedback Report"
                            >
                              {actionLoading === `excel-${t._id}` ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />}
                              Excel Report
                            </button>
                            <button
                              onClick={() => openEditModal(t)}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Edit Email & Profile"
                            >
                              <Edit2 size={14} />
                              Edit
                            </button>
                            <button
                              onClick={() => handleResetPassword(t._id, t.name)}
                              disabled={actionLoading === `pwd-${t._id}`}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                              title="Reset Password to 12345678"
                            >
                              {actionLoading === `pwd-${t._id}` ? <Loader2 size={14} className="spin" /> : <Key size={14} />}
                              Reset PW
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
        </div>
      )}

      {/* Edit / Create Modal */}
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
                {isEditing ? 'Edit Faculty Profile & Email' : 'Create New Faculty Profile'}
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
                  <label className="form-label">RUET Edumail (Official Login &amp; Notifications Email)</label>
                  <input 
                    type="email" className="form-input" placeholder="e.g. teacher@ete.ruet.ac.bd"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                  <div style={{ 
                    marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)',
                    padding: '8px 12px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.15)'
                  }}>
                    💡 Updating this email synchronizes the faculty profile and their portal login account everywhere across the entire system.
                  </div>
                </div>

                <div>
                  <label className="form-label">Courses (Comma Separated)</label>
                  <input 
                    type="text" className="form-input" placeholder="e.g. ETE 3101, ETE 3102, EEE 2101"
                    value={form.courses} onChange={e => setForm({ ...form, courses: e.target.value })}
                  />
                </div>

                {isEditing && (
                  <div style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)', marginTop: '5px'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Password Management</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Default initial password is <code>12345678</code>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(editId, form.name)}
                      className="btn btn-outline btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Key size={14} />
                      Reset to 12345678
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '15px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    {isEditing ? 'Save Changes Everywhere' : 'Create Teacher'}
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
