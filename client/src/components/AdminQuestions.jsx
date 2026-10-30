/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileQuestion, Plus, Trash2, Save, RotateCcw, ArrowUp, ArrowDown,
  BookOpen, Target, Building2, UserCheck, Layers, Loader2, Info
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const CORE_SECTIONS = [
  {
    key: 'courseContent',
    badge: 'Section 1',
    icon: BookOpen,
    color: 'var(--ruet-gold)',
    hint: 'Evaluates course syllabus, organization, workload, or learning materials.'
  },
  {
    key: 'coSection',
    badge: 'Section 2 (Repeated per CO)',
    icon: Target,
    color: 'var(--ruet-emerald)',
    hint: 'Use {CO} in any question text to automatically insert CO1, CO2, CO3, etc. for each Course Outcome of the course.'
  },
  {
    key: 'facilities',
    badge: 'Section 3',
    icon: Building2,
    color: '#818CF8',
    hint: 'Evaluates classrooms, laboratory equipment, infrastructure, and academic support.'
  },
  {
    key: 'courseTeacher',
    badge: 'Section 4',
    icon: UserCheck,
    color: '#F43F5E',
    hint: 'Evaluates instructor preparation, lecture delivery, communication, and overall teaching.'
  }
];

function makeQuestionId(prefix) {
  return `${prefix}_q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function AdminQuestions() {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/feedback-questions');
      setConfig({
        courseContent: res.data.courseContent || { id: 'courseContent', title: 'Course Content and Organization', scaleType: 'likert', questions: [] },
        coSection: res.data.coSection || { id: 'coSection', title: 'Course Outcomes (COs)', scaleType: 'likert', questions: [] },
        facilities: res.data.facilities || { id: 'facilities', title: 'Academic and Laboratory Facilities', scaleType: 'likert', questions: [] },
        courseTeacher: res.data.courseTeacher || { id: 'courseTeacher', title: 'Course Teacher', scaleType: 'rating', questions: [] },
        customSections: Array.isArray(res.data.customSections) ? res.data.customSections : []
      });
    } catch {
      toast.error('Failed to load feedback questions configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const updateCoreSection = (sectionKey, updater) => {
    setConfig(prev => ({
      ...prev,
      [sectionKey]: updater(prev[sectionKey])
    }));
  };

  const updateCustomSection = (index, updater) => {
    setConfig(prev => {
      const next = [...prev.customSections];
      next[index] = updater(next[index]);
      return { ...prev, customSections: next };
    });
  };

  const addQuestionToSection = (isCustom, keyOrIdx) => {
    const applyAdd = (sec) => ({
      ...sec,
      questions: [
        ...(sec.questions || []),
        {
          id: makeQuestionId(sec.id || 'sec'),
          text: sec.id === 'coSection' ? 'New evaluation question for {CO}' : ''
        }
      ]
    });
    if (isCustom) {
      updateCustomSection(keyOrIdx, applyAdd);
    } else {
      updateCoreSection(keyOrIdx, applyAdd);
    }
  };

  const updateQuestionText = (isCustom, keyOrIdx, qIndex, value) => {
    const applyUpdate = (sec) => {
      const nextQs = [...(sec.questions || [])];
      nextQs[qIndex] = { ...nextQs[qIndex], text: value };
      return { ...sec, questions: nextQs };
    };
    if (isCustom) {
      updateCustomSection(keyOrIdx, applyUpdate);
    } else {
      updateCoreSection(keyOrIdx, applyUpdate);
    }
  };

  const removeQuestionFromSection = (isCustom, keyOrIdx, qIndex) => {
    const applyRemove = (sec) => ({
      ...sec,
      questions: (sec.questions || []).filter((_, i) => i !== qIndex)
    });
    if (isCustom) {
      updateCustomSection(keyOrIdx, applyRemove);
    } else {
      updateCoreSection(keyOrIdx, applyRemove);
    }
  };

  const moveQuestion = (isCustom, keyOrIdx, qIndex, direction) => {
    const applyMove = (sec) => {
      const nextQs = [...(sec.questions || [])];
      const targetIdx = qIndex + direction;
      if (targetIdx < 0 || targetIdx >= nextQs.length) return sec;
      const temp = nextQs[qIndex];
      nextQs[qIndex] = nextQs[targetIdx];
      nextQs[targetIdx] = temp;
      return { ...sec, questions: nextQs };
    };
    if (isCustom) {
      updateCustomSection(keyOrIdx, applyMove);
    } else {
      updateCoreSection(keyOrIdx, applyMove);
    }
  };

  const addCustomSection = () => {
    const newId = `custom_${Date.now().toString(36)}`;
    setConfig(prev => ({
      ...prev,
      customSections: [
        ...(prev.customSections || []),
        {
          id: newId,
          title: `Additional Evaluation Section ${(prev.customSections?.length || 0) + 1}`,
          scaleType: 'likert',
          questions: [{ id: makeQuestionId(newId), text: '' }]
        }
      ]
    }));
  };

  const removeCustomSection = (idx) => {
    setConfig(prev => ({
      ...prev,
      customSections: prev.customSections.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await api.put('/admin/feedback-questions', config);
      setConfig({
        courseContent: res.data.config.courseContent,
        coSection: res.data.config.coSection,
        facilities: res.data.config.facilities,
        courseTeacher: res.data.config.courseTeacher,
        customSections: res.data.config.customSections || []
      });
      toast.success(res.data.message || 'Feedback questions saved! Student form, Excel, and Word reports updated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save feedback questions');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Restore all feedback sections and questions to the default template?')) return;
    setResetting(true);
    try {
      const res = await api.post('/admin/feedback-questions/reset');
      setConfig({
        courseContent: res.data.config.courseContent,
        coSection: res.data.config.coSection,
        facilities: res.data.config.facilities,
        courseTeacher: res.data.config.courseTeacher,
        customSections: res.data.config.customSections || []
      });
      toast.success('Restored default feedback questions!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore defaults');
    } finally {
      setResetting(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', marginTop: '20px' }}>
        Loading feedback questions configuration...
      </div>
    );
  }

  const renderSectionCard = ({ section, isCustom, keyOrIdx, badge, IconComp, color, hint }) => {
    const questions = section?.questions || [];
    return (
      <motion.div
        key={section.id || keyOrIdx}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ padding: '24px', marginBottom: '20px', borderLeft: `4px solid ${color}` }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <IconComp size={18} style={{ color }} />
              <span className="badge" style={{ background: 'var(--bg-elevated)', color, fontWeight: 700, fontSize: '0.75rem' }}>
                {badge}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ({questions.length} {questions.length === 1 ? 'question' : 'questions'})
              </span>
            </div>
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Section Heading</label>
            <input
              type="text"
              className="form-input"
              value={section.title || ''}
              onChange={e => {
                const val = e.target.value;
                if (isCustom) updateCustomSection(keyOrIdx, s => ({ ...s, title: val }));
                else updateCoreSection(keyOrIdx, s => ({ ...s, title: val }));
              }}
              placeholder="Section Title"
              style={{ fontWeight: 600 }}
            />
          </div>

          <div style={{ minWidth: '230px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Response Scale</label>
            <select
              className="form-select"
              value={section.scaleType || 'likert'}
              onChange={e => {
                const val = e.target.value;
                if (isCustom) updateCustomSection(keyOrIdx, s => ({ ...s, scaleType: val }));
                else updateCoreSection(keyOrIdx, s => ({ ...s, scaleType: val }));
              }}
            >
              <option value="likert">Likert (Strongly Agree → Strongly Disagree)</option>
              <option value="rating">Numeric Rating (5 - Excellent → 1 - Poor)</option>
            </select>
          </div>

          {isCustom && (
            <button
              type="button"
              onClick={() => removeCustomSection(keyOrIdx)}
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--text-danger)', borderColor: 'rgba(239, 68, 68, 0.3)', marginTop: '24px' }}
              title="Remove Custom Section"
            >
              <Trash2 size={15} /> Remove Section
            </button>
          )}
        </div>

        {hint && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.18)',
            fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '16px'
          }}>
            <Info size={15} style={{ color: '#60A5FA', flexShrink: 0 }} />
            <span>{hint}</span>
          </div>
        )}

        {/* Questions list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {questions.length === 0 ? (
            <div style={{
              padding: '16px', borderRadius: '8px', border: '1px dashed var(--border-default)',
              textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem'
            }}>
              No questions in this section (this section will be skipped in the student form and reports). Click <strong>+ Add Question</strong> below to include questions.
            </div>
          ) : (
            questions.map((q, qIdx) => (
              <div
                key={q.id || qIdx}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--bg-elevated)', padding: '10px 12px',
                  borderRadius: '8px', border: '1px solid var(--border-default)'
                }}
              >
                <span style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'rgba(212, 168, 67, 0.15)', color: 'var(--ruet-gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.82rem', flexShrink: 0
                }}>
                  {qIdx + 1}
                </span>

                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={q.text || ''}
                  placeholder={section.id === 'coSection' ? 'e.g. The course contents are aligned with {CO}' : 'Enter feedback question text...'}
                  onChange={e => updateQuestionText(isCustom, keyOrIdx, qIdx, e.target.value)}
                />

                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => moveQuestion(isCustom, keyOrIdx, qIdx, -1)}
                    disabled={qIdx === 0}
                    className="btn btn-outline btn-sm"
                    style={{ padding: '6px 8px', opacity: qIdx === 0 ? 0.4 : 1 }}
                    title="Move Up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(isCustom, keyOrIdx, qIdx, 1)}
                    disabled={qIdx === questions.length - 1}
                    className="btn btn-outline btn-sm"
                    style={{ padding: '6px 8px', opacity: qIdx === questions.length - 1 ? 0.4 : 1 }}
                    title="Move Down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestionFromSection(isCustom, keyOrIdx, qIdx)}
                    className="btn btn-outline btn-sm"
                    style={{ padding: '6px 8px', color: 'var(--text-danger)', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                    title="Remove Question"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '14px' }}>
          <button
            type="button"
            onClick={() => addQuestionToSection(isCustom, keyOrIdx)}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: color, color }}
          >
            <Plus size={15} /> Add Question
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileQuestion style={{ color: 'var(--ruet-gold)' }} />
            Customize Feedback Questions
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Only Administrators can edit, add, or remove questions. Saving automatically updates the Student Review Form, Database, Excel (.xlsx), and Word (.docx) reports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={resetting || saving}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {resetting ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />}
            Restore Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Questions'}
          </button>
        </div>
      </div>

      {CORE_SECTIONS.map(meta =>
        renderSectionCard({
          section: config[meta.key],
          isCustom: false,
          keyOrIdx: meta.key,
          badge: meta.badge,
          IconComp: meta.icon,
          color: meta.color,
          hint: meta.hint
        })
      )}

      {(config.customSections || []).map((sec, idx) =>
        renderSectionCard({
          section: sec,
          isCustom: true,
          keyOrIdx: idx,
          badge: `Custom Section ${idx + 1}`,
          IconComp: Layers,
          color: '#14B8A6',
          hint: 'Custom section added by Admin — included in the student evaluation form, Excel report, and Word report.'
        })
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '12px' }}>
        <button
          type="button"
          onClick={addCustomSection}
          className="btn btn-outline"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: '#14B8A6', color: '#14B8A6' }}
        >
          <Plus size={16} /> Add New Custom Section
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
