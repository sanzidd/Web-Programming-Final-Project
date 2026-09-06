const mongoose = require('mongoose');

// Sub-schema for individual CO feedback
const coFeedbackSchema = new mongoose.Schema({
  coNumber: { type: Number, required: true },
  coTitle: { type: String, default: '' },
  coDescription: { type: String, default: '' },
  // Q1: To what extent this course helped you achieve this CO (1=Not at all, 5=Completely)
  q1_achievement: { type: Number, required: true, min: 1, max: 5 },
  // Q2: Does the teaching-learning method align with this CO (1=SD, 5=SA)
  q2_alignment: { type: Number, required: true, min: 1, max: 5 },
  // Q3: Does the assessment tool engage you in learning (1=SD, 5=SA)
  q3_assessment: { type: Number, required: true, min: 1, max: 5 },
  // Q4: Comments
  comment: { type: String, default: '' }
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  courseName: { type: String, required: true },
  
  // Section 1: Course Content & Organisation (3 Likert + comment)
  courseContentOrg: {
    q1_objectives: { type: Number, required: true, min: 1, max: 5 },   // Course objectives were clear
    q2_workload: { type: Number, required: true, min: 1, max: 5 },     // Course workload manageable
    q3_organized: { type: Number, required: true, min: 1, max: 5 },    // Course was well organized
    comment: { type: String, default: '' }
  },

  // Section 2: CO-specific feedback (dynamic array)
  coFeedback: { type: [coFeedbackSchema], default: [] },

  // Section 3: Teaching-Learning & Assessment (4 Likert + comment)
  teachingLearning: {
    q1_structured: { type: Number, required: true, min: 1, max: 5 },       // Well structured for learning outcomes
    q2_participation: { type: Number, required: true, min: 1, max: 5 },    // Methods encouraged participation
    q3_materials: { type: Number, required: true, min: 1, max: 5 },        // Learning materials relevant/useful
    q4_assessment: { type: Number, required: true, min: 1, max: 5 },       // Assessment encourages applying knowledge
    comment: { type: String, default: '' }
  },

  // Section 4: Academic and Laboratory Facilities (3 Likert + comment)
  academicFacilities: {
    q1_environment: { type: Number, required: true, min: 1, max: 5 },  // Environment conducive to learning
    q2_classrooms: { type: Number, required: true, min: 1, max: 5 },   // Classrooms satisfactory
    q3_laboratory: { type: Number, required: true, min: 1, max: 5 },   // Lab facilities adequate
    comment: { type: String, default: '' }
  },

  sentiment: { type: String, enum: ['positive', 'neutral', 'negative', null, ''], default: null },
}, { timestamps: true });

// Index for efficient analytics queries
feedbackSchema.index({ teacher: 1, createdAt: -1 });
feedbackSchema.index({ department: 1, createdAt: -1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
