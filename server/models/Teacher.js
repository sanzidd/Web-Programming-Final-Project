const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  designation: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  email: { type: String },
  photoUrl: { type: String, default: '' },
  courses: [{ type: String }],
  avgRating: { type: Number, default: 0 },
  avgCourseContent: { type: Number, default: 0 },
  avgTeachingLearning: { type: Number, default: 0 },
  avgFacilities: { type: Number, default: 0 },
  avgCOAttainment: { type: Number, default: 0 },
  totalFeedbacks: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);
