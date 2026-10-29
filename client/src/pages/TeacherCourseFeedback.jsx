import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  ArrowLeft, Download, Star, MessageSquare, BarChart3,
  Loader2, FileSpreadsheet,
  BookOpen, User, Target, FlaskConical, Presentation
} from 'lucide-react';
import './TeacherCourseFeedback.css';

function scoreToLabel(score) {
  const map = { 5: 'Strongly Agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly Disagree' };
  return map[score] || '-';
}

function achievementToLabel(score) {
  const map = { 1: 'Not at all', 2: 'Slightly', 3: 'Moderately', 4: 'Significantly', 5: 'Completely' };
  return map[score] || '-';
}

function teacherRatingToLabel(score) {
  const map = { 1: '1 - Poor', 2: '2 - Fair', 3: '3 - Good', 4: '4 - Very Good', 5: '5 - Excellent' };
  return map[score] || '-';
}

const avgOf = (vals) => {
  const valid = vals.map(Number).filter(v => v > 0);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
};

// Per-feedback overall score (current form fields, with fallback for older submissions)
function computeFeedbackOverall(fb) {
  const c = fb.courseContentOrg || {};
  const content = c.q1_upToDate ? Number(c.q1_upToDate) : avgOf([c.q1_objectives, c.q2_workload, c.q3_organized]);
  const co = avgOf((fb.coFeedback || []).map(e => (
    avgOf([e.q1_contentAligned, e.q2_methodsEffective, e.q3_assessmentAppropriate]) ?? avgOf([e.q1_achievement])
  )));
  const af = fb.academicFacilities || {};
  const facilities = af.q1_infrastructure ? Number(af.q1_infrastructure) : avgOf([af.q1_environment, af.q2_classrooms, af.q3_laboratory]);
  const teacher = fb.courseTeacherEval?.rating ? Number(fb.courseTeacherEval.rating) : null;
  const overall = avgOf([content, co, facilities, teacher]);
  return overall ? +overall.toFixed(1) : 0;
}

function RatingBadge({ value, max = 5 }) {
  let cls = 'rating-badge';
  if (value >= 4) cls += ' high';
  else if (value >= 3) cls += ' mid';
  else cls += ' low';
  return <span className={cls}>{value}/{max}</span>;
}

export default function TeacherCourseFeedback() {
  const { courseName: rawCourseName } = useParams();
  const courseName = decodeURIComponent(rawCourseName);
  const { isTeacher } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isTeacher) {
      navigate('/teacher/login');
      return;
    }
    fetchFeedback();
  }, [isTeacher, courseName]);

  const fetchFeedback = async () => {
    try {
      const res = await api.get(`/teacher-auth/course-feedback/${encodeURIComponent(courseName)}`);
      setData(res.data);
    } catch (err) {
      showToast('Failed to load feedback', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(
        `/teacher-auth/course-feedback/${encodeURIComponent(courseName)}/export`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Student_Feedback_${courseName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Excel file downloaded!', 'success');
    } catch (err) {
      showToast('Failed to export feedback', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="tcf-loading">
        <Loader2 size={40} className="spin" />
        <p>Loading course feedback...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="tcf-loading">
        <p>Unable to load feedback data.</p>
      </div>
    );
  }

  const { summary, feedbacks } = data;

  return (
    <div className="teacher-course-feedback">
      <div className="container">
        {/* Back + Header */}
        <div className="tcf-top">
          <Link to="/teacher/dashboard" className="tcf-back">
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>
        </div>

        <div className="tcf-header">
          <div className="tcf-header-left">
            <div className="tcf-course-icon">
              <BookOpen size={28} />
            </div>
            <div>
              <h1 className="tcf-title font-display">{courseName}</h1>
              <p className="tcf-subtitle">{summary.totalFeedbacks} student feedbacks</p>
            </div>
          </div>
          <button
            className="btn btn-primary tcf-export-btn"
            onClick={handleExport}
            disabled={exporting || feedbacks.length === 0}
          >
            {exporting ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            {exporting ? 'Exporting...' : 'Download Excel'}
          </button>
        </div>

        {/* Summary Stats */}
        <div className="tcf-stats">
          {[
            { label: 'Course Content', value: summary.avgCourseContent },
            { label: 'CO Attainment', value: summary.avgCOAttainment },
            { label: 'Facilities', value: summary.avgFacilities },
            { label: 'Course Teacher', value: summary.avgCourseTeacher || 0 },
            { label: 'Overall', value: summary.avgOverall },
          ].map(item => (
            <div key={item.label} className="tcf-stat-item">
              <div className="tcf-stat-val">{item.value}</div>
              <div className="tcf-stat-bar">
                <div className="tcf-stat-fill" style={{ width: `${(item.value / 5) * 100}%` }} />
              </div>
              <div className="tcf-stat-lbl">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Individual Feedbacks */}
        <div className="tcf-section">
          <h2 className="tcf-section-title font-display">
            <MessageSquare size={20} /> Individual Responses
          </h2>

          {feedbacks.length === 0 ? (
            <div className="tcf-empty">
              <p>No feedbacks for this course yet.</p>
            </div>
          ) : (
            <div className="tcf-feedback-list">
              {feedbacks.map((fb, idx) => {
                const overall = computeFeedbackOverall(fb);
                const isLegacy = !fb.courseContentOrg?.q1_upToDate;

                return (
                  <div key={fb._id} className="tcf-fb-card glass-card">
                    <div className="tcf-fb-header">
                      <div className="tcf-fb-student">
                        <User size={16} />
                        <span>Student #{idx + 1}</span>
                      </div>
                      <RatingBadge value={overall} />
                    </div>

                    <div className="tcf-fb-sections">
                      {/* Section 1: Course Content */}
                      <div className="tcf-fb-section">
                        <h4><BookOpen size={14} style={{ marginRight: '6px' }} />Course Content & Organisation</h4>
                        <div className="tcf-fb-answers">
                          {isLegacy ? (
                            <>
                              <span>Objectives: {scoreToLabel(fb.courseContentOrg?.q1_objectives)}</span>
                              <span>Workload: {scoreToLabel(fb.courseContentOrg?.q2_workload)}</span>
                              <span>Organized: {scoreToLabel(fb.courseContentOrg?.q3_organized)}</span>
                            </>
                          ) : (
                            <span>Up-to-date & well organized: {scoreToLabel(fb.courseContentOrg?.q1_upToDate)}</span>
                          )}
                        </div>
                        {fb.courseContentOrg?.comment && (
                          <p className="tcf-fb-comment">"{fb.courseContentOrg.comment}"</p>
                        )}
                      </div>

                      {/* Section 2: CO Feedback */}
                      {(fb.coFeedback || []).map((co, i) => (
                        <div className="tcf-fb-section" key={i}>
                          <h4 style={{ color: 'var(--ruet-emerald)' }}>
                            <Target size={14} style={{ marginRight: '6px' }} />
                            CO{co.coNumber}: {co.coTitle}
                          </h4>
                          <div className="tcf-fb-answers">
                            {co.q1_contentAligned ? (
                              <>
                                <span>Contents aligned: {scoreToLabel(co.q1_contentAligned)}</span>
                                <span>T-L methods effective: {scoreToLabel(co.q2_methodsEffective)}</span>
                                <span>Assessment appropriate: {scoreToLabel(co.q3_assessmentAppropriate)}</span>
                              </>
                            ) : (
                              <>
                                <span>Achievement: {achievementToLabel(co.q1_achievement)}</span>
                                <span>TL Alignment: {scoreToLabel(co.q2_alignment)}</span>
                                <span>Assessment: {scoreToLabel(co.q3_assessment)}</span>
                              </>
                            )}
                          </div>
                          {co.comment && (
                            <p className="tcf-fb-comment">"{co.comment}"</p>
                          )}
                        </div>
                      ))}

                      {/* Legacy: Teaching-Learning (older submissions only) */}
                      {fb.teachingLearning?.q1_structured && (
                        <div className="tcf-fb-section">
                          <h4><Presentation size={14} style={{ marginRight: '6px' }} />Teaching-Learning & Assessment</h4>
                          <div className="tcf-fb-answers">
                            <span>Structured: {scoreToLabel(fb.teachingLearning?.q1_structured)}</span>
                            <span>Participation: {scoreToLabel(fb.teachingLearning?.q2_participation)}</span>
                            <span>Materials: {scoreToLabel(fb.teachingLearning?.q3_materials)}</span>
                            <span>Assessment: {scoreToLabel(fb.teachingLearning?.q4_assessment)}</span>
                          </div>
                          {fb.teachingLearning?.comment && (
                            <p className="tcf-fb-comment">"{fb.teachingLearning.comment}"</p>
                          )}
                        </div>
                      )}

                      {/* Section 4: Facilities */}
                      <div className="tcf-fb-section">
                        <h4><FlaskConical size={14} style={{ marginRight: '6px' }} />Academic & Lab Facilities</h4>
                        <div className="tcf-fb-answers">
                          {fb.academicFacilities?.q1_infrastructure ? (
                            <span>Infrastructure adequate: {scoreToLabel(fb.academicFacilities?.q1_infrastructure)}</span>
                          ) : (
                            <>
                              <span>Environment: {scoreToLabel(fb.academicFacilities?.q1_environment)}</span>
                              <span>Classrooms: {scoreToLabel(fb.academicFacilities?.q2_classrooms)}</span>
                              <span>Lab: {scoreToLabel(fb.academicFacilities?.q3_laboratory)}</span>
                            </>
                          )}
                        </div>
                        {fb.academicFacilities?.comment && (
                          <p className="tcf-fb-comment">"{fb.academicFacilities.comment}"</p>
                        )}
                      </div>

                      {/* Course Teacher */}
                      {fb.courseTeacherEval?.rating && (
                        <div className="tcf-fb-section">
                          <h4><User size={14} style={{ marginRight: '6px' }} />Course Teacher</h4>
                          <div className="tcf-fb-answers">
                            <span>Rating: {teacherRatingToLabel(fb.courseTeacherEval.rating)}</span>
                          </div>
                          {fb.courseTeacherEval?.comment && (
                            <p className="tcf-fb-comment">"{fb.courseTeacherEval.comment}"</p>
                          )}
                        </div>
                      )}

                      {/* Legacy: Overall Comment (older submissions only) */}
                      {(fb.overallComment || fb.commentsAndSuggestions) && (
                        <div className="tcf-fb-section">
                          <h4><MessageSquare size={14} style={{ marginRight: '6px' }} />Additional Comments</h4>
                          <p className="tcf-fb-comment">"{fb.overallComment || fb.commentsAndSuggestions}"</p>
                        </div>
                      )}
                    </div>

                    <div className="tcf-fb-footer">
                      <span className="tcf-fb-date">
                        {new Date(fb.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
