const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  designation: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  email: { type: String },
  photoUrl: { type: String, default: '' },
  courses: [{ type: String }],
  avgRating: { type: Number, default: 0 },
  avgStructure: { type: Number, default: 0 },
  avgDelivery: { type: Number, default: 0 },
  avgDuration: { type: Number, default: 0 },
  avgEnvironment: { type: Number, default: 0 },
  avgSkill: { type: Number, default: 0 },
  totalFeedbacks: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);
