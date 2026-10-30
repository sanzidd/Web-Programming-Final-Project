const mongoose = require('mongoose');

const questionItemSchema = new mongoose.Schema({
  id: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true }
}, { _id: false });

const sectionConfigSchema = new mongoose.Schema({
  id: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  scaleType: { type: String, enum: ['likert', 'rating'], default: 'likert' },
  questions: { type: [questionItemSchema], default: [] }
}, { _id: false });

const DEFAULT_CONFIG = {
  key: 'default',
  courseContent: {
    id: 'courseContent',
    title: 'Course Content and Organization',
    scaleType: 'likert',
    questions: [
      { id: 'cc_q1', text: 'The course contents are up-to-date and well organized' }
    ]
  },
  coSection: {
    id: 'coSection',
    title: 'Course Outcomes (COs)',
    scaleType: 'likert',
    questions: [
      { id: 'co_q1', text: 'The course contents are aligned with {CO}' },
      { id: 'co_q2', text: 'The teaching-learning methods are effective to achieve {CO}' },
      { id: 'co_q3', text: 'The used assessment tools are appropriate for {CO}' }
    ]
  },
  facilities: {
    id: 'facilities',
    title: 'Academic and Laboratory Facilities',
    scaleType: 'likert',
    questions: [
      { id: 'fac_q1', text: 'Infrastructure and academic facilities are adequate to achieve the COs' }
    ]
  },
  courseTeacher: {
    id: 'courseTeacher',
    title: 'Course Teacher',
    scaleType: 'rating',
    questions: [
      { id: 'ct_q1', text: 'Evaluate the course teacher based on class preparation, lecture delivery, and way of teaching' }
    ]
  },
  customSections: []
};

const feedbackConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  courseContent: { type: sectionConfigSchema, required: true },
  coSection: { type: sectionConfigSchema, required: true },
  facilities: { type: sectionConfigSchema, required: true },
  courseTeacher: { type: sectionConfigSchema, required: true },
  customSections: { type: [sectionConfigSchema], default: [] }
}, { timestamps: true });

feedbackConfigSchema.statics.getDefaultPayload = function () {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
};

feedbackConfigSchema.statics.getConfig = async function () {
  let doc = await this.findOne({ key: 'default' });
  if (!doc) {
    doc = await this.create(this.getDefaultPayload());
  }
  return doc;
};

module.exports = mongoose.model('FeedbackConfig', feedbackConfigSchema);
