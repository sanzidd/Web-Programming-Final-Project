/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, Trash2, Edit2, Calendar, Filter, CheckCircle2, AlertCircle,
  Eye, ToggleLeft, ToggleRight, Target, X, Mail, Loader2, Send,
  FileSpreadsheet, FileText, Clock, Search
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function toLocalDatetimeInputValue(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDeadlineDisplay(dateVal) {
  if (!dateVal) return 'No Deadline';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return 'No Deadline';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const SEMESTERS = [
  '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
  '5th Semester', '6th Semester', '7th Semester', '8th Semester'
];

export default function AdminAssignments() {
  const toast = useToast();
  const [assignments, setAssignments] = useState([]);
  const [courseCatalog, setCourseCatalog] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSemesterFilter, setCatalogSemesterFilter] = useState('');
  const [selectedCatalogCode, setSelectedCatalogCode] = useState('');

  // Quick Extend / Set Deadline Modal
  const [deadlineModalTarget, setDeadlineModalTarget] = useState(null);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterTeacherDept, setFilterTeacherDept] = useState('');
  const [filterSeries, setFilterSeries] = useState('');

  // Status Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [currentStatusList, setCurrentStatusList] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);

  // Email Reports
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [showEmailReportModal, setShowEmailReportModal] = useState(false);
  const [selectedEmailCourseId, setSelectedEmailCourseId] = useState('');
  const [sendingEmailReport, setSendingEmailReport] = useState(false);

  const emptyForm = () => {
    const eteDept = departments.find(d => d.code === 'ETE');
    return {
      courseCode: '',
      courseName: '',
      department: eteDept?._id || departments[0]?._id || '',
      teacherDepartment: eteDept?._id || '',
      semester: '1st Semester',
      series: '21',
      teacher: '',
      feedbackDeadline: '',
      courseOutcomes: [{ coNumber: 1, title: '', description: '' }]
    };
  };

  const [form, setForm] = useState({
    courseCode: '',
    courseName: '',
    department: '',
    teacherDepartment: '',
    semester: '1st Semester',
    series: '21',
    teacher: '',
    feedbackDeadline: '',
    courseOutcomes: [{ coNumber: 1, title: '', description: '' }]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignRes, deptRes, teacherRes, catalogRes] = await Promise.all([
        api.get('/admin/assignments'),
        api.get('/departments'),
        api.get('/teachers'),
        api.get('/admin/course-catalog').catch(() => ({ data: [] }))
      ]);
      setAssignments(assignRes.data || []);
      setDepartments(deptRes.data || []);
      setTeachers(teacherRes.data || []);
      setCourseCatalog(catalogRes.data || []);
    } catch {
      toast.error('Failed to load course assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingAssignmentId(null);
    setSelectedCatalogCode('');
    setCatalogSearch('');
    setCatalogSemesterFilter('');
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEditModal = (a) => {
    setEditingAssignmentId(a._id);
    setSelectedCatalogCode(a.courseCode || '');
    setCatalogSearch('');
    setCatalogSemesterFilter('');
    setForm({
      courseCode: a.courseCode || '',
      courseName: a.courseName || '',
      department: a.department?._id || a.department || '',
      teacherDepartment: a.teacherDepartment?._id || a.teacherDepartment || a.teacher?.department?._id || a.teacher?.department || '',
      semester: a.semester || '1st Semester',
      series: a.series || '21',
      teacher: a.teacher?._id || a.teacher || '',
      feedbackDeadline: toLocalDatetimeInputValue(a.feedbackDeadline),
      courseOutcomes: Array.isArray(a.courseOutcomes) && a.courseOutcomes.length > 0
        ? a.courseOutcomes.map((co, i) => ({
            coNumber: co.coNumber || i + 1,
            title: co.title || '',
            description: co.description || ''
          }))
        : [{ coNumber: 1, title: '', description: '' }]
    });
    setShowModal(true);
  };

  const handleSelectCatalogCourse = (courseCode) => {
    setSelectedCatalogCode(courseCode);
    if (!courseCode) return;
    const found = courseCatalog.find(c => c.courseCode === courseCode);
    if (!found) return;
    setForm(prev => ({
      ...prev,
      courseCode: found.courseCode,
      courseName: found.courseName,
      semester: found.semester || prev.semester,
      courseOutcomes: Array.isArray(found.courseOutcomes) && found.courseOutcomes.length > 0
        ? found.courseOutcomes.map((co, idx) => ({
            coNumber: co.coNumber || idx + 1,
            title: co.title || `CO${idx + 1}`,
            description: co.description || ''
          }))
        : [{ coNumber: 1, title: '', description: '' }]
    }));
  };

  const handleStudentDeptChange = (deptId) => {
    setForm(f => ({ ...f, department: deptId }));
  };

  const handleTeacherDeptChange = (deptId) => {
    setForm(f => {
      const isTeacherInNewDept = teachers.some(t => t._id === f.teacher && ((t.department?._id || t.department) === deptId));
      return {
        ...f,
        teacherDepartment: deptId,
        teacher: (deptId && !isTeacherInNewDept) ? '' : f.teacher
      };
    });
  };

  const handleTeacherChangeInForm = (teacherId) => {
    const found = teachers.find(t => t._id === teacherId);
    const teacherDeptId = found?.department?._id || found?.department || '';
    setForm(f => ({
      ...f,
      teacher: teacherId,
      teacherDepartment: f.teacherDepartment || teacherDeptId
    }));
  };

  const addCO = () => {
    setForm(f => ({
      ...f,
      courseOutcomes: [
        ...f.courseOutcomes,
        { coNumber: f.courseOutcomes.length + 1, title: `CO${f.courseOutcomes.length + 1}`, description: '' }
      ]
    }));
  };

  const removeCO = (index) => {
    setForm(f => {
      const updated = f.courseOutcomes.filter((_, i) => i !== index);
      return { ...f, courseOutcomes: updated.map((co, i) => ({ ...co, coNumber: i + 1 })) };
    });
  };

  const updateCO = (index, field, value) => {
    setForm(f => {
      const updated = [...f.courseOutcomes];
      updated[index] = { ...updated[index], [field]: value };
      return { ...f, courseOutcomes: updated };
    });
  };

  const seriesOptions = (() => {
    const currentYear = new Date().getFullYear();
    const startSeries = currentYear - 6;
    const endSeries = currentYear + 1;
    const options = [];
    for (let y = startSeries; y <= endSeries; y++) {
      options.push(String(y).slice(-2));
    }
    return options;
  })();

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!form.courseCode || !form.courseName || !form.department || !form.series || !form.teacher) {
      toast.error('Please fill in all required fields');
      return;
    }

    const validCOs = form.courseOutcomes
      .filter(co => (co.title && co.title.trim()) || (co.description && co.description.trim()))
      .map((co, idx) => ({
        coNumber: idx + 1,
        title: (co.title && co.title.trim()) ? co.title.trim() : `CO${idx + 1}`,
        description: (co.description || '').trim()
      }));

    const payload = {
      ...form,
      feedbackDeadline: form.feedbackDeadline ? new Date(form.feedbackDeadline).toISOString() : null,
      courseOutcomes: validCOs
    };

    try {
      if (editingAssignmentId) {
        await api.put(`/admin/assignments/${editingAssignmentId}`, payload);
        toast.success('Course assignment & COs updated in database!');
      } else {
        await api.post('/admin/assignments', payload);
        toast.success('Course assignment created successfully!');
      }
      setShowModal(false);
      setEditingAssignmentId(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save assignment');
    }
  };

  const openDeadlineModal = (a) => {
    setDeadlineModalTarget(a);
    setDeadlineInput(toLocalDatetimeInputValue(a.feedbackDeadline));
  };

  const applyQuickDaysExtension = (days) => {
    const base = deadlineInput ? new Date(deadlineInput) : new Date();
    const start = Number.isNaN(base.getTime()) || base.getTime() < Date.now() ? new Date() : base;
    start.setDate(start.getDate() + days);
    start.setHours(23, 59, 0, 0);
    setDeadlineInput(toLocalDatetimeInputValue(start));
  };

  const handleSaveDeadline = async (clear = false) => {
    if (!deadlineModalTarget) return;
    setSavingDeadline(true);
    try {
      const payload = {
        feedbackDeadline: clear || !deadlineInput ? null : new Date(deadlineInput).toISOString()
      };
      const res = await api.put(`/admin/assignments/${deadlineModalTarget._id}/deadline`, payload);
      toast.success(res.data.message || 'Deadline updated!');
      setAssignments(prev => prev.map(item => item._id === deadlineModalTarget._id ? res.data.assignment : item));
      setDeadlineModalTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update deadline');
    } finally {
      setSavingDeadline(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this course assignment?')) return;
    try {
      await api.delete(`/admin/assignments/${id}`);
      toast.success('Assignment deleted');
      setAssignments(prev => prev.filter(a => a._id !== id));
    } catch {
      toast.error('Failed to delete assignment');
    }
  };

  const handleToggleSession = async (a) => {
    if (a.isDeadlinePassed && !a.effectiveSessionOpen) {
      toast.info('This assignment deadline has passed. Extend or clear the deadline to re-open the session.');
      openDeadlineModal(a);
      return;
    }
    try {
      const res = await api.post(`/admin/assignments/${a._id}/toggle-session`, {
        isReviewSessionOpen: !a.isReviewSessionOpen
      });
      toast.success(`Review session ${res.data.effectiveSessionOpen ? 'OPENED' : 'CLOSED'} for ${a.courseName}`);
      setAssignments(prev => prev.map(item => item._id === a._id ? res.data : item));
    } catch {
      toast.error('Failed to toggle session');
    }
  };

  const handleViewStatus = async (id) => {
    setStatusLoading(true);
    setStatusModalOpen(true);
    setCurrentStatusList([]);
    try {
      const res = await api.get(`/admin/assignments/${id}/status`);
      setCurrentStatusList(res.data);
    } catch {
      toast.error('Failed to fetch status');
      setStatusModalOpen(false);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDownloadExcel = async (a) => {
    try {
      toast.info(`Generating Excel (.xlsx) for ${a.courseName}...`);
      const response = await api.get(`/admin/assignments/${a._id}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Feedback_Report_${a.courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel report downloaded');
    } catch {
      toast.error('Failed to download Excel');
    }
  };

  const handleDownloadWord = async (a) => {
    try {
      toast.info(`Generating Word (.docx) for ${a.courseName}...`);
      const response = await api.get(`/admin/assignments/${a._id}/export-doc`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Final_Feedback_${a.courseName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Word report (.docx) downloaded');
    } catch {
      toast.error('Failed to download Word report');
    }
  };

  const handleSendSingleReport = async (a) => {
    if (!window.confirm(`Email the official XLSX feedback report for "${a.courseName}" directly to ${a.teacher?.name || 'the teacher'}?`)) {
      return;
    }
    setSendingEmailId(a._id);
    try {
      const res = await api.post(`/admin/assignments/${a._id}/send-report`);
      toast.success(res.data.message || 'Report emailed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to email report');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleSendReportFromModal = async () => {
    if (!selectedEmailCourseId) return;
    setSendingEmailReport(true);
    try {
      if (selectedEmailCourseId === 'all') {
        const res = await api.post('/admin/assignments/send-bulk-reports');
        toast.success(res.data.message || 'Reports emailed to all faculty!');
      } else {
        const targetAssign = assignments.find(a => a._id === selectedEmailCourseId);
        const res = await api.post(`/admin/assignments/${selectedEmailCourseId}/send-report`);
        toast.success(res.data.message || `Feedback report for ${targetAssign?.courseName || 'course'} successfully sent!`);
      }
      setShowEmailReportModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to email report');
    } finally {
      setSendingEmailReport(false);
    }
  };

  const filteredAssignments = assignments.filter(a => {
    if (filterDept && a.department?._id !== filterDept) return false;
    if (filterTeacherDept) {
      const teacherDeptId = a.teacherDepartment?._id || a.teacherDepartment || a.teacher?.department?._id || a.teacher?.department;
      if (teacherDeptId !== filterTeacherDept) return false;
    }
    if (filterSeries && a.series !== filterSeries) return false;
    return true;
  });

  const availableTeachersForForm = form.teacherDepartment
    ? teachers.filter(t => (t.department?._id || t.department) === form.teacherDepartment)
    : teachers;

  const filteredCatalog = courseCatalog.filter(c => {
    if (catalogSemesterFilter && c.semester !== catalogSemesterFilter) return false;
    if (catalogSearch.trim()) {
      const q = catalogSearch.trim().toLowerCase();
      return (
        c.courseCode?.toLowerCase().includes(q) ||
        c.courseName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="admin-assignments-container" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen style={{ color: 'var(--ruet-gold)' }} />
            Course &amp; Teacher Assignments
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Assign pre-enlisted OBE courses to faculty, manage Course Outcomes (COs), set deadlines, and download Excel or Word reports.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setSelectedEmailCourseId('');
              setShowEmailReportModal(true);
            }}
            className="btn btn-outline"
            style={{ borderColor: 'var(--ruet-emerald)', color: 'var(--ruet-emerald)', display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Email feedback reports (.xlsx) to faculty"
          >
            <Mail size={16} />
            Email Reports to Faculty
          </button>
          <button onClick={openCreateModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} />
            Create Assignment
          </button>
        </div>
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
          <option value="">All Student Depts</option>
          {departments.map(d => (
            <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.9rem' }}
          value={filterTeacherDept}
          onChange={e => setFilterTeacherDept(e.target.value)}
        >
          <option value="">All Faculty Depts</option>
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
          {seriesOptions.map(s => (
            <option key={s} value={s}>Series {s}</option>
          ))}
          <option value="all">All Series (Universal)</option>
        </select>
        {(filterDept || filterTeacherDept || filterSeries) && (
          <button onClick={() => { setFilterDept(''); setFilterTeacherDept(''); setFilterSeries(''); }} className="btn btn-outline btn-sm">
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
            <button onClick={openCreateModal} className="btn btn-primary btn-sm" style={{ marginTop: '15px' }}>
              Create Assignment
            </button>
          </div>
        ) : (
          <div className="feedback-table-wrap">
            <table className="feedback-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Student Dept &amp; Series</th>
                  <th>Faculty &amp; Dept</th>
                  <th>Semester</th>
                  <th>COs</th>
                  <th>Deadline</th>
                  <th>Session</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map(a => {
                  const studentDeptCode = a.department?.code || a.department?.name || '—';
                  const teacherDeptCode = a.teacherDepartment?.code || a.teacher?.department?.code || a.teacherDepartment?.name || a.teacher?.department?.name || '—';
                  const isCrossDept = a.department && (a.teacherDepartment || a.teacher?.department) &&
                    (a.department?._id?.toString() !== (a.teacherDepartment?._id || a.teacher?.department?._id || a.teacherDepartment || a.teacher?.department)?.toString());
                  const isOpen = a.effectiveSessionOpen !== undefined
                    ? a.effectiveSessionOpen
                    : (a.isReviewSessionOpen !== false && !a.isDeadlinePassed);

                  return (
                    <tr key={a._id}>
                      <td>
                        <div className="assignment-course-code">{a.courseCode}</div>
                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{a.courseName}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <span className="badge badge-blue">{studentDeptCode}</span>
                          <span className="badge badge-emerald" style={{ fontSize: '0.75rem' }}>Series {a.series}</span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.teacher?.name || '—'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                            <span>{a.teacher?.designation || ''}</span>
                            <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>Dept: {teacherDeptCode}</span>
                            {isCrossDept && (
                              <span className="badge badge-orange" style={{ fontSize: '0.7rem' }}>Cross-Dept</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{a.semester || '—'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => openEditModal(a)}
                          className="badge"
                          title="Click to view or edit Course Outcomes"
                          style={{
                            background: 'rgba(39, 174, 96, 0.15)',
                            color: 'var(--ruet-emerald)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: '1px solid rgba(39, 174, 96, 0.3)',
                            cursor: 'pointer'
                          }}
                        >
                          <Target size={12} />
                          {a.courseOutcomes?.length || 0} COs
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            color: a.isDeadlinePassed ? 'var(--text-danger)' : (a.feedbackDeadline ? 'var(--text-primary)' : 'var(--text-muted)')
                          }}>
                            {formatDeadlineDisplay(a.feedbackDeadline)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openDeadlineModal(a)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Clock size={11} />
                            {a.feedbackDeadline ? 'Extend / Edit' : 'Set Deadline'}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isOpen ? 'badge-emerald' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {isOpen ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {isOpen ? 'Open' : (a.isDeadlinePassed ? 'Expired' : 'Closed')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => openEditModal(a)}
                            className="btn btn-outline btn-sm"
                            title="Edit Assignment, COs & Deadline"
                            style={{ padding: '6px 9px' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleSession(a)}
                            className="btn btn-outline btn-sm"
                            title={isOpen ? 'Close Session' : 'Open Session'}
                            style={{ padding: '6px 9px', color: isOpen ? 'var(--text-danger)' : 'var(--ruet-emerald)', borderColor: isOpen ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)' }}
                          >
                            {isOpen ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button
                            onClick={() => handleViewStatus(a._id)}
                            className="btn btn-outline btn-sm"
                            title="View Student Submission Status"
                            style={{ padding: '6px 9px' }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDownloadExcel(a)}
                            className="btn btn-outline btn-sm"
                            title="Download Excel Report (.xlsx)"
                            style={{ padding: '6px 10px', color: 'var(--ruet-gold)', borderColor: 'rgba(212, 175, 55, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FileSpreadsheet size={14} />
                            <span style={{ fontSize: '0.75rem' }}>Excel</span>
                          </button>
                          <button
                            onClick={() => handleDownloadWord(a)}
                            className="btn btn-outline btn-sm"
                            title="Download Final Feedback Word Report (.docx)"
                            style={{ padding: '6px 10px', color: '#60A5FA', borderColor: 'rgba(59, 130, 246, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FileText size={14} />
                            <span style={{ fontSize: '0.75rem' }}>Word</span>
                          </button>
                          <button
                            onClick={() => handleSendSingleReport(a)}
                            className="btn btn-outline btn-sm"
                            title={`Email XLSX Report to ${a.teacher?.name || 'Teacher'}`}
                            style={{ padding: '6px 9px', color: 'var(--ruet-emerald)', borderColor: 'rgba(16, 185, 129, 0.25)' }}
                            disabled={sendingEmailId === a._id}
                          >
                            {sendingEmailId === a._id ? <Loader2 size={14} className="spin" /> : <Mail size={14} />}
                          </button>
                          <button
                            onClick={() => handleDelete(a._id)}
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--text-danger)', borderColor: 'rgba(239, 68, 68, 0.25)', padding: '6px 9px' }}
                            title="Delete Assignment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Assignment Modal */}
      <AnimatePresence>
        {showModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px',
            overflowY: 'auto'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card modal-card glass-card-modal"
              style={{ width: '100%', maxWidth: '820px', padding: '30px', background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                <div>
                  <h3 className="font-display" style={{ marginBottom: '4px', fontSize: '1.35rem' }}>
                    {editingAssignmentId ? 'Edit Course Assignment & COs' : 'Create Assignment'}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Select a pre-enlisted OBE course to auto-load its Course Outcomes, assign a teacher, and optionally customize COs or set a feedback deadline.
                  </p>
                </div>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Pre-enlisted OBE Course Selector */}
                <div style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(212, 168, 67, 0.07)',
                  border: '1px solid rgba(212, 168, 67, 0.3)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--ruet-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BookOpen size={16} />
                      Select Pre-Enlisted OBE Course ({courseCatalog.length} Courses Loaded)
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        className="form-select"
                        style={{ width: 'auto', padding: '4px 10px', fontSize: '0.82rem' }}
                        value={catalogSemesterFilter}
                        onChange={e => setCatalogSemesterFilter(e.target.value)}
                      >
                        <option value="">All Semesters</option>
                        {SEMESTERS.map(sem => (
                          <option key={sem} value={sem}>{sem}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '4px 10px' }}>
                        <Search size={13} style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          placeholder="Search code or title..."
                          value={catalogSearch}
                          onChange={e => setCatalogSearch(e.target.value)}
                          style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.82rem', width: '150px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <select
                    className="form-select"
                    value={selectedCatalogCode}
                    onChange={e => handleSelectCatalogCourse(e.target.value)}
                  >
                    <option value="">— Choose a course from the OBE Curriculum Book (auto-fills Code, Title, Semester &amp; COs) —</option>
                    {filteredCatalog.map(c => (
                      <option key={c._id || c.courseCode} value={c.courseCode}>
                        {c.courseCode} — {c.courseName} ({c.semester || 'OBE'} · {c.courseOutcomes?.length || 0} COs)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 1: Course Code & Course Name */}
                <div className="form-grid-2-asym">
                  <div>
                    <label className="form-label">Course Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. ETE 3101"
                      value={form.courseCode}
                      onChange={e => setForm({ ...form, courseCode: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Course Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Digital Signal Processing"
                      value={form.courseName}
                      onChange={e => setForm({ ...form, courseName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Student Department & Series */}
                <div className="form-grid-2">
                  <div>
                    <label className="form-label">Student Department (Enrolled Class) *</label>
                    <select
                      className="form-select"
                      value={form.department}
                      onChange={e => handleStudentDeptChange(e.target.value)}
                      required
                    >
                      <option value="">Select Student Department...</option>
                      {departments.map(d => (
                        <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Series *</label>
                    <select
                      className="form-select"
                      value={form.series}
                      onChange={e => setForm({ ...form, series: e.target.value })}
                      required
                    >
                      {seriesOptions.map(s => (
                        <option key={s} value={s}>Series {s}</option>
                      ))}
                      <option value="all">All Series (Universal)</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Teacher's Department & Assigned Teacher */}
                <div className="form-grid-2">
                  <div>
                    <label className="form-label">Teacher&apos;s Department (Faculty)</label>
                    <select
                      className="form-select"
                      value={form.teacherDepartment}
                      onChange={e => handleTeacherDeptChange(e.target.value)}
                    >
                      <option value="">All Faculty Departments (Any)</option>
                      {departments.map(d => (
                        <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Assigned Teacher *</label>
                    <select
                      className="form-select"
                      value={form.teacher}
                      onChange={e => handleTeacherChangeInForm(e.target.value)}
                      required
                    >
                      <option value="">Select Teacher...</option>
                      {availableTeachersForForm.map(t => (
                        <option key={t._id} value={t._id}>
                          {t.name} — {t.designation} ({t.department?.code || t.department?.name || 'Dept'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 4: Semester & Feedback Deadline */}
                <div className="form-grid-2">
                  <div>
                    <label className="form-label">Semester *</label>
                    <select
                      className="form-select"
                      value={form.semester}
                      onChange={e => setForm({ ...form, semester: e.target.value })}
                      required
                    >
                      {SEMESTERS.map(sem => (
                        <option key={sem} value={sem}>{sem}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Feedback Deadline (Optional)</span>
                      {form.feedbackDeadline && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, feedbackDeadline: '' })}
                          style={{ background: 'none', border: 'none', color: 'var(--text-danger)', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Clear
                        </button>
                      )}
                    </label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={form.feedbackDeadline}
                      onChange={e => setForm({ ...form, feedbackDeadline: e.target.value })}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                      Review closes automatically after this deadline. Admin or assigned teacher can extend it anytime.
                    </span>
                  </div>
                </div>

                {/* Course Outcomes Section */}
                <div style={{
                  border: '1px solid rgba(39, 174, 96, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  background: 'rgba(39, 174, 96, 0.04)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Target size={18} style={{ color: 'var(--ruet-emerald)' }} />
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ruet-emerald)' }}>
                        Course Outcomes (COs)
                        <span style={{ fontWeight: 400, fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          (Editable by Admin &amp; Assigned Teacher — updates database)
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addCO}
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--ruet-emerald)', borderColor: 'rgba(39, 174, 96, 0.3)' }}
                    >
                      <Plus size={14} /> Add CO
                    </button>
                  </div>

                  {form.courseOutcomes.map((co, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '14px',
                        marginBottom: '10px',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--ruet-emerald)', fontSize: '0.88rem' }}>
                          CO{co.coNumber}
                        </span>
                        {form.courseOutcomes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCO(index)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-danger)', padding: '4px' }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={`CO${co.coNumber} Title (e.g., "CO${co.coNumber}" or short outcome title)`}
                          value={co.title}
                          onChange={e => updateCO(index, 'title', e.target.value)}
                          style={{ fontSize: '0.9rem' }}
                        />
                        <textarea
                          className="form-textarea"
                          placeholder={`CO${co.coNumber} Details / Statement (from OBE Book or customized)`}
                          value={co.description}
                          onChange={e => updateCO(index, 'description', e.target.value)}
                          rows={2}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    {editingAssignmentId ? 'Save Changes' : 'Create Assignment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Set / Extend Deadline Modal */}
      <AnimatePresence>
        {deadlineModalTarget && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card"
              style={{ width: '100%', maxWidth: '480px', padding: '28px', background: 'var(--bg-card)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 className="font-display" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--ruet-gold)' }} />
                  Set / Extend Feedback Deadline
                </h3>
                <button onClick={() => setDeadlineModalTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                <strong>{deadlineModalTarget.courseCode}</strong> — {deadlineModalTarget.courseName} (Series {deadlineModalTarget.series})
              </p>

              <label className="form-label">Feedback Closing Date &amp; Time</label>
              <input
                type="datetime-local"
                className="form-input"
                value={deadlineInput}
                onChange={e => setDeadlineInput(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => applyQuickDaysExtension(3)} className="btn btn-outline btn-sm">+3 Days</button>
                <button type="button" onClick={() => applyQuickDaysExtension(7)} className="btn btn-outline btn-sm">+7 Days</button>
                <button type="button" onClick={() => applyQuickDaysExtension(14)} className="btn btn-outline btn-sm">+14 Days</button>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                Extending the deadline to a future date automatically re-opens the review session for students.
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '20px' }}>
                {deadlineModalTarget.feedbackDeadline ? (
                  <button
                    type="button"
                    onClick={() => handleSaveDeadline(true)}
                    disabled={savingDeadline}
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--text-danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                  >
                    Remove Deadline
                  </button>
                ) : <div />}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setDeadlineModalTarget(null)} className="btn btn-outline">Cancel</button>
                  <button
                    type="button"
                    onClick={() => handleSaveDeadline(false)}
                    disabled={savingDeadline || !deadlineInput}
                    className="btn btn-primary"
                  >
                    {savingDeadline ? 'Saving...' : 'Save Deadline'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Modal */}
      <AnimatePresence>
        {statusModalOpen && (
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
              style={{ width: '100%', maxWidth: '600px', padding: '30px', background: 'var(--bg-card)', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 className="font-display" style={{ fontSize: '1.3rem' }}>Feedback Submission Status</h3>
                <button onClick={() => setStatusModalOpen(false)} className="btn btn-sm btn-outline">Close</button>
              </div>

              {statusLoading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>Loading status...</div>
              ) : currentStatusList.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No students found matching this series.
                </div>
              ) : (
                <div className="feedback-table-wrap">
                  <table className="feedback-table">
                    <thead>
                      <tr>
                        <th>Roll Number</th>
                        <th>Name</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentStatusList.map(s => (
                        <tr key={s.roll}>
                          <td style={{ fontWeight: 600 }}>{s.roll}</td>
                          <td>{s.name}</td>
                          <td>
                            {s.hasSubmitted ? (
                              <span className="badge badge-emerald"><CheckCircle2 size={12} /> Feedback Given</span>
                            ) : (
                              <span className="badge badge-danger"><AlertCircle size={12} /> Not Given</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Email Report to Faculty Modal */}
      <AnimatePresence>
        {showEmailReportModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px',
            backdropFilter: 'blur(6px)'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card"
              style={{ width: '100%', maxWidth: '640px', padding: '30px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--ruet-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={22} />
                  </div>
                  <div>
                    <h3 className="font-display" style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>Email Reports to Faculty</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '3px 0 0' }}>
                      Select a specific course to email its evaluation report (.xlsx) to the faculty member.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailReportModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px' }}>Select Course / Target *</label>
                <select
                  className="form-select"
                  value={selectedEmailCourseId}
                  onChange={e => setSelectedEmailCourseId(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', fontSize: '0.95rem' }}
                >
                  <option value="">Select Course (e.g. ETE 4101)...</option>
                  <option value="all" style={{ fontWeight: 700, color: 'var(--ruet-emerald)' }}>
                    🌟 All Courses (Send Reports to All Assigned Faculty at Once)
                  </option>
                  {assignments.map(a => {
                    const studentCode = a.department?.code || a.department?.name || 'Dept';
                    const facultyName = a.teacher?.name || 'Unassigned';
                    return (
                      <option key={a._id} value={a._id}>
                        {a.courseCode}: {a.courseName} — {facultyName} ({studentCode} · Series {a.series})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedEmailCourseId && selectedEmailCourseId !== 'all' && (() => {
                const targetAssign = assignments.find(a => a._id === selectedEmailCourseId);
                if (!targetAssign) return null;
                const teacherDept = targetAssign.teacherDepartment?.name || targetAssign.teacher?.department?.name || targetAssign.teacherDepartment?.code || targetAssign.teacher?.department?.code || 'N/A';
                return (
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="assignment-course-code" style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', display: 'inline-block', marginBottom: '4px' }}>
                          {targetAssign.courseCode}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{targetAssign.courseName}</h4>
                      </div>
                      <span className="badge badge-emerald">Series {targetAssign.series}</span>
                    </div>

                    <div className="modal-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <div><strong>Student Dept:</strong> {targetAssign.department?.name} ({targetAssign.department?.code})</div>
                      <div><strong>Faculty Dept:</strong> {teacherDept}</div>
                      <div><strong>Assigned Teacher:</strong> {targetAssign.teacher?.name} ({targetAssign.teacher?.designation})</div>
                      <div><strong>Recipient Email:</strong> <span style={{ color: 'var(--ruet-emerald)' }}>{targetAssign.teacher?.email || 'No email registered'}</span></div>
                    </div>
                  </div>
                );
              })()}

              {selectedEmailCourseId === 'all' && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  marginBottom: '20px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5
                }}>
                  📢 <strong>Batch Delivery:</strong> Official XLSX feedback analysis reports will be generated and emailed to all <strong>{assignments.length}</strong> assigned teachers directly to their institutional email addresses.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowEmailReportModal(false)}
                  className="btn btn-outline"
                  disabled={sendingEmailReport}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendReportFromModal}
                  className="btn btn-primary"
                  disabled={!selectedEmailCourseId || sendingEmailReport}
                  style={{ background: 'var(--ruet-emerald)', borderColor: 'var(--ruet-emerald)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {sendingEmailReport ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                  {sendingEmailReport
                    ? 'Generating & Sending...'
                    : selectedEmailCourseId === 'all'
                      ? 'Email Reports to All Faculty'
                      : 'Email Report to Faculty'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
