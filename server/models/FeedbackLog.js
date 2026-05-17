const mongoose = require('mongoose');

// Stores a hash of studentId+teacherId to prevent duplicate feedback
// Cannot be reverse-traced to identify which student gave which feedback
const feedbackLogSchema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
}, { timestamps: true });

feedbackLogSchema.index({ hash: 1 });

module.exports = mongoose.model('FeedbackLog', feedbackLogSchema);
