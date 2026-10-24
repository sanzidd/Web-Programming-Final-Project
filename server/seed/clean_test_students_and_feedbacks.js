const mongoose = require('mongoose');
require('dotenv').config();

const Student = require('../models/Student');
const Feedback = require('../models/Feedback');
const FeedbackLog = require('../models/FeedbackLog');
const Teacher = require('../models/Teacher');

async function cleanTestData() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ruet-feedback';
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}...`);
  
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // 1. Delete all student profiles
  const studentRes = await Student.deleteMany({});
  console.log(`✓ Deleted ${studentRes.deletedCount} student accounts.`);

  // 2. Delete all feedback submissions
  const feedbackRes = await Feedback.deleteMany({});
  console.log(`✓ Deleted ${feedbackRes.deletedCount} feedback records.`);

  // 3. Delete all feedback logs (prevents duplicate lockouts)
  const logRes = await FeedbackLog.deleteMany({});
  console.log(`✓ Deleted ${logRes.deletedCount} submission history logs.`);

  // 4. Reset all teacher rating statistics to 0
  const teacherRes = await Teacher.updateMany({}, {
    $set: {
      totalFeedbacks: 0,
      avgRating: 0,
      avgCourseContent: 0,
      avgTeachingLearning: 0,
      avgFacilities: 0,
      avgCOAttainment: 0
    }
  });
  console.log(`✓ Reset ratings and feedback counters to 0 on ${teacherRes.modifiedCount} faculty profiles.`);

  console.log('\n======================================================');
  console.log('SUCCESS: All test data has been cleared.');
  console.log('The system is clean and ready for real student testing.');
  console.log('======================================================');

  await mongoose.disconnect();
}

cleanTestData().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
