const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  courseName: { type: String, default: '' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  teachingQuality: { type: Number, required: true, min: 1, max: 5 },
  communication: { type: Number, required: true, min: 1, max: 5 },
  helpfulness: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
}, { timestamps: true });

// Index for efficient analytics queries
feedbackSchema.index({ teacher: 1, createdAt: -1 });
feedbackSchema.index({ department: 1, createdAt: -1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
