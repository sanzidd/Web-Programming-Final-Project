import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  ArrowLeft, Download, Star, MessageSquare, BarChart3,
  ThumbsUp, Minus, ThumbsDown, Loader2, FileSpreadsheet,
  BookOpen, User
} from 'lucide-react';
import './TeacherCourseFeedback.css';

function scoreToLabel(score) {
  const map = { 5: 'Strongly Agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly Disagree' };
  return map[score] || '-';
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
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  feedbacks.forEach(f => sentimentCounts[f.sentiment || 'neutral']++);

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
            { label: 'Structure', value: summary.avgStructure },
            { label: 'Delivery', value: summary.avgDelivery },
            { label: 'Duration', value: summary.avgDuration },
            { label: 'Environment', value: summary.avgEnvironment },
            { label: 'Skill Dev', value: summary.avgSkill },
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

        {/* Sentiment */}
        <div className="tcf-sentiment-row">
          <div className="tcf-sent-item positive">
            <ThumbsUp size={16} />
            <span>{sentimentCounts.positive} Positive</span>
          </div>
          <div className="tcf-sent-item neutral">
            <Minus size={16} />
            <span>{sentimentCounts.neutral} Neutral</span>
          </div>
          <div className="tcf-sent-item negative">
            <ThumbsDown size={16} />
            <span>{sentimentCounts.negative} Negative</span>
          </div>
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
              {feedbacks.map((fb, idx) => (
                <div key={fb._id} className="tcf-fb-card glass-card">
                  <div className="tcf-fb-header">
                    <div className="tcf-fb-student">
                      <User size={16} />
                      <span>Student #{idx + 1}</span>
                    </div>
                    <RatingBadge value={fb.courseRating?.overall || 0} />
                  </div>

                  {/* Collapsed summary of all sections */}
                  <div className="tcf-fb-sections">
                    <div className="tcf-fb-section">
                      <h4>Course Content</h4>
                      <div className="tcf-fb-answers">
                        <span>Q1: {scoreToLabel(fb.courseContent?.q1)}</span>
                        <span>Q2: {scoreToLabel(fb.courseContent?.q2)}</span>
                        <span>Q3: {scoreToLabel(fb.courseContent?.q3)}</span>
                      </div>
                      {fb.courseContent?.comment && (
                        <p className="tcf-fb-comment">"{fb.courseContent.comment}"</p>
                      )}
                    </div>

                    <div className="tcf-fb-section">
                      <h4>Student Contribution</h4>
                      <div className="tcf-fb-answers">
                        <span>Q5: {scoreToLabel(fb.studentContribution?.q5)}</span>
                        <span>Q6: {scoreToLabel(fb.studentContribution?.q6)}</span>
                      </div>
                      {fb.studentContribution?.comment && (
                        <p className="tcf-fb-comment">"{fb.studentContribution.comment}"</p>
                      )}
                    </div>

                    <div className="tcf-fb-section">
                      <h4>Learning Environment</h4>
                      <div className="tcf-fb-answers">
                        <span>Q8: {scoreToLabel(fb.learningEnvironment?.q8)}</span>
                        <span>Q9: {scoreToLabel(fb.learningEnvironment?.q9)}</span>
                        <span>Q10: {scoreToLabel(fb.learningEnvironment?.q10)}</span>
                        <span>Q11: {scoreToLabel(fb.learningEnvironment?.q11)}</span>
                      </div>
                      {fb.learningEnvironment?.comment && (
                        <p className="tcf-fb-comment">"{fb.learningEnvironment.comment}"</p>
                      )}
                    </div>

                    <div className="tcf-fb-section">
                      <h4>Learning Resources</h4>
                      <div className="tcf-fb-answers">
                        <span>Q13: {scoreToLabel(fb.learningResources?.q13)}</span>
                        <span>Q14: {scoreToLabel(fb.learningResources?.q14)}</span>
                        <span>Q15: {scoreToLabel(fb.learningResources?.q15)}</span>
                      </div>
                      {fb.learningResources?.comment && (
                        <p className="tcf-fb-comment">"{fb.learningResources.comment}"</p>
                      )}
                    </div>

                    <div className="tcf-fb-section">
                      <h4>Course Teacher</h4>
                      <div className="tcf-fb-answers">
                        <span>Q17: {scoreToLabel(fb.courseTeacher?.q17)}</span>
                        <span>Q18: {scoreToLabel(fb.courseTeacher?.q18)}</span>
                        <span>Q19: {scoreToLabel(fb.courseTeacher?.q19)}</span>
                        <span>Q20: {scoreToLabel(fb.courseTeacher?.q20)}</span>
                        <span>Q21: {scoreToLabel(fb.courseTeacher?.q21)}</span>
                        <span>Q22: {scoreToLabel(fb.courseTeacher?.q22)}</span>
                      </div>
                      {fb.courseTeacher?.comment && (
                        <p className="tcf-fb-comment">"{fb.courseTeacher.comment}"</p>
                      )}
                    </div>

                    <div className="tcf-fb-section">
                      <h4>Course Rating</h4>
                      <div className="tcf-fb-ratings">
                        <span>Structure: <strong>{fb.courseRating?.structure}</strong></span>
                        <span>Delivery: <strong>{fb.courseRating?.delivery}</strong></span>
                        <span>Duration: <strong>{fb.courseRating?.duration}</strong></span>
                        <span>Environment: <strong>{fb.courseRating?.environment}</strong></span>
                        <span>Skill: <strong>{fb.courseRating?.skill}</strong></span>
                        <span>Overall: <strong>{fb.courseRating?.overall}</strong></span>
                      </div>
                      {fb.courseRating?.comment && (
                        <p className="tcf-fb-comment">"{fb.courseRating.comment}"</p>
                      )}
                    </div>
                  </div>

                  {/* Overall Feedback */}
                  {fb.overallFeedback && (
                    <div className="tcf-fb-overall">
                      <h4>Overall Feedback</h4>
                      <p className="tcf-fb-text">"{fb.overallFeedback}"</p>
                    </div>
                  )}

                  <div className="tcf-fb-footer">
                    <span className={`sentiment-tag ${fb.sentiment}`}>
                      {fb.sentiment === 'positive' && <ThumbsUp size={12} />}
                      {fb.sentiment === 'neutral' && <Minus size={12} />}
                      {fb.sentiment === 'negative' && <ThumbsDown size={12} />}
                      {fb.sentiment}
                    </span>
                    <span className="tcf-fb-date">
                      {new Date(fb.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
