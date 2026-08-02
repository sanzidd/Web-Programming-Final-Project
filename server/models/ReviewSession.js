const mongoose = require('mongoose');

const reviewSessionSchema = new mongoose.Schema({
  isOpen: {
    type: Boolean,
    default: true,
    required: true
  },
  sessionName: {
    type: String,
    default: 'Current Semester Review Session',
    trim: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  message: {
    type: String,
    default: 'Thank you for participating in the teacher evaluation survey.'
  },
  closedMessage: {
    type: String,
    default: 'The teacher feedback session is currently closed. Please check back later during the designated evaluation period.'
  }
}, { timestamps: true });

// Helper static method to get or create the singleton review session
reviewSessionSchema.statics.getCurrentSession = async function() {
  let session = await this.findOne();
  if (!session) {
    session = await this.create({ isOpen: true });
  }
  return session;
};

module.exports = mongoose.model('ReviewSession', reviewSessionSchema);
