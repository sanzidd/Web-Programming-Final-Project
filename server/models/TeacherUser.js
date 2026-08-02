const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teacherUserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  designation: { type: String, default: '' },
  // Links to existing Teacher profile document (for accessing feedbacks)
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  isVerified: { type: Boolean, default: false },
  forcePasswordChange: { type: Boolean, default: true },
  verificationCode: { type: String },
  verificationExpires: { type: Date },
}, { timestamps: true });

// Hash password before saving
teacherUserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
teacherUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('TeacherUser', teacherUserSchema);
