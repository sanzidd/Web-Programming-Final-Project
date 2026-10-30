const mongoose = require('mongoose');

const dynamicAnswerSchema = new mongoose.Schema({
  questionId: { type: String, required: true, trim: true },
  questionText: { type: String, default: '', trim: true },
  score: { type: Number, min: 1, max: 5, required: true }
}, { _id: false });

const customSectionResponseSchema = new mongoose.Schema({
  sectionId: { type: String, required: true, trim: true },
  title: { type: String, default: '', trim: true },
  scaleType: { type: String, enum: ['likert', 'rating'], default: 'likert' },
  responses: { type: [dynamicAnswerSchema], default: [] },
  comment: { type: String, default: '' }
}, { _id: false });

// Sub-schema for individual CO feedback
const coFeedbackSchema = new mongoose.Schema({
  coNumber: { type: Number, required: true },
  coTitle: { type: String, default: '' },
  coDescription: { type: String, default: '' },
  responses: { type: [dynamicAnswerSchema], default: [] },
  // The course contents are aligned with this CO (1=SD, 5=SA)
  q1_contentAligned: { type: Number, min: 1, max: 5 },
  // The teaching-learning methods are effective to achieve this CO (1=SD, 5=SA)
  q2_methodsEffective: { type: Number, min: 1, max: 5 },
  // The used assessment tools are appropriate for this CO (1=SD, 5=SA)
  q3_assessmentAppropriate: { type: Number, min: 1, max: 5 },
  // Any other comments
  comment: { type: String, default: '' },

  // Legacy fields (older submissions only)
  q1_achievement: { type: Number, min: 1, max: 5 },
  q2_alignment: { type: Number, min: 1, max: 5 },
  q3_assessment: { type: Number, min: 1, max: 5 },
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  courseName: { type: String, required: true },
  
  // Course Content & Organisation
  courseContentOrg: {
    responses: { type: [dynamicAnswerSchema], default: [] },
    q1_upToDate: { type: Number, min: 1, max: 5 },     // The course contents are up-to-date and well organized
    comment: { type: String, default: '' },
    // Legacy fields (older submissions only)
    q1_objectives: { type: Number, min: 1, max: 5 },
    q2_workload: { type: Number, min: 1, max: 5 },
    q3_organized: { type: Number, min: 1, max: 5 },
  },

  // CO-specific feedback (dynamic array, one entry per CO)
  coFeedback: { type: [coFeedbackSchema], default: [] },

  // Academic & Laboratory Facilities
  academicFacilities: {
    responses: { type: [dynamicAnswerSchema], default: [] },
    q1_infrastructure: { type: Number, min: 1, max: 5 }, // Infrastructure and academic facilities are adequate to achieve the COs
    comment: { type: String, default: '' },
    // Legacy fields (older submissions only)
    q1_environment: { type: Number, min: 1, max: 5 },
    q2_classrooms: { type: Number, min: 1, max: 5 },
    q3_laboratory: { type: Number, min: 1, max: 5 },
  },

  // Course Teacher (1 = Poor ... 5 = Excellent)
  courseTeacherEval: {
    responses: { type: [dynamicAnswerSchema], default: [] },
    rating: { type: Number, min: 1, max: 5 }, // Class preparation, lecture delivery, and way of teaching
    comment: { type: String, default: '' },
  },

  // Optional custom sections configured by Admin
  customSections: { type: [customSectionResponseSchema], default: [] },

  // Legacy: Teaching-Learning & Assessment (section removed from the form; older submissions only)
  teachingLearning: {
    q1_structured: { type: Number, min: 1, max: 5 },
    q2_participation: { type: Number, min: 1, max: 5 },
    q3_materials: { type: Number, min: 1, max: 5 },
    q4_assessment: { type: Number, min: 1, max: 5 },
    comment: { type: String },
  },

  // Legacy: Overall Student Comments & Suggestions (older submissions only)
  overallComment: { type: String, default: '', trim: true },
  commentsAndSuggestions: { type: String, default: '', trim: true },

  sentiment: { type: String, enum: ['positive', 'neutral', 'negative', null, ''], default: null },
}, { timestamps: true });

// Index for efficient analytics queries
feedbackSchema.index({ teacher: 1, createdAt: -1 });
feedbackSchema.index({ department: 1, createdAt: -1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
