const mongoose = require('mongoose');

const courseAssignmentSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, trim: true },
  courseName: { type: String, required: true, trim: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  semester: { type: String, default: '' },
  series: { type: String, required: true, trim: true }, // e.g. "20", "21", or "all"
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  isActive: { type: Boolean, default: true },
  isReviewSessionOpen: { type: Boolean, default: true },
}, { timestamps: true });

// Index for fast lookups by student department and series
courseAssignmentSchema.index({ department: 1, series: 1, isActive: 1 });
courseAssignmentSchema.index({ teacher: 1 });

module.exports = mongoose.model('CourseAssignment', courseAssignmentSchema);
