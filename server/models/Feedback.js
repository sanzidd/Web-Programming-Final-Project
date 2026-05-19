const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  courseName: { type: String, required: true },
  
  // Section A: Core Questions (1-5 scale)
  courseContent: {
    q1: { type: Number, required: true, min: 1, max: 5 },
    q2: { type: Number, required: true, min: 1, max: 5 },
    q3: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' }
  },
  studentContribution: {
    q5: { type: Number, required: true, min: 1, max: 5 },
    q6: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' }
  },
  learningEnvironment: {
    q8: { type: Number, required: true, min: 1, max: 5 },
    q9: { type: Number, required: true, min: 1, max: 5 },
    q10: { type: Number, required: true, min: 1, max: 5 },
    q11: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' }
  },
  learningResources: {
    q13: { type: Number, required: true, min: 1, max: 5 },
    q14: { type: Number, required: true, min: 1, max: 5 },
    q15: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' }
  },
  courseTeacher: {
    q17: { type: Number, required: true, min: 1, max: 5 },
    q18: { type: Number, required: true, min: 1, max: 5 },
    q19: { type: Number, required: true, min: 1, max: 5 },
    q20: { type: Number, required: true, min: 1, max: 5 },
    q21: { type: Number, required: true, min: 1, max: 5 },
    q22: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' }
  },

  // Section B: Course Rating (1-5 scale)
  courseRating: {
    structure: { type: Number, required: true, min: 1, max: 5 },
    delivery: { type: Number, required: true, min: 1, max: 5 },
    duration: { type: Number, required: true, min: 1, max: 5 },
    environment: { type: Number, required: true, min: 1, max: 5 },
    skill: { type: Number, required: true, min: 1, max: 5 },
    overall: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' }
  },

  // Section C: General Feedback
  overallFeedback: { type: String, required: true },
  
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
}, { timestamps: true });

// Index for efficient analytics queries
feedbackSchema.index({ teacher: 1, createdAt: -1 });
feedbackSchema.index({ department: 1, createdAt: -1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
