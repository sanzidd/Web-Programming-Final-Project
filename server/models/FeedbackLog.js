const mongoose = require('mongoose');

// Tracks which student has submitted feedback for which course assignment.
// This allows the admin to see who submitted feedback, while keeping the actual Feedback collection anonymous.
const feedbackLogSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseAssignment' },
  hash: { type: String, sparse: true, unique: true }, // Kept for legacy records
}, { timestamps: true });

feedbackLogSchema.index({ student: 1, assignment: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('FeedbackLog', feedbackLogSchema);
