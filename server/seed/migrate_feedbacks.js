require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ruet-feedback');
  console.log('Connected!');

  const collection = mongoose.connection.collection('feedbacks');
  const legacyFeedbacks = await collection.find({ courseContentOrg: { $exists: false } }).toArray();
  console.log(`Found ${legacyFeedbacks.length} legacy feedbacks to migrate...`);

  let migrated = 0;
  for (const f of legacyFeedbacks) {
    const courseContentOrg = {
      q1_objectives: f.courseContent?.q1 || f.courseRating?.structure || 4,
      q2_workload: f.courseContent?.q2 || f.courseRating?.duration || 3,
      q3_organized: f.courseContent?.q3 || f.courseRating?.structure || 4,
      comment: f.courseContent?.comment || ''
    };

    const teachingLearning = {
      q1_structured: f.learningEnvironment?.q8 || f.courseRating?.structure || 4,
      q2_participation: f.learningEnvironment?.q9 || f.courseTeacher?.q20 || 4,
      q3_materials: f.learningResources?.q13 || 4,
      q4_assessment: f.learningResources?.q14 || f.courseTeacher?.q18 || 4,
      comment: f.learningEnvironment?.comment || ''
    };

    const academicFacilities = {
      q1_environment: f.learningEnvironment?.q10 || f.courseRating?.environment || 4,
      q2_classrooms: f.learningEnvironment?.q11 || f.courseRating?.environment || 4,
      q3_laboratory: f.learningResources?.q15 || f.courseRating?.environment || 4,
      comment: f.learningResources?.comment || ''
    };

    await collection.updateOne(
      { _id: f._id },
      {
        $set: {
          courseContentOrg,
          teachingLearning,
          academicFacilities,
          coFeedback: f.coFeedback || []
        }
      }
    );
    migrated++;
  }

  console.log(`Successfully migrated ${migrated} feedbacks to the new schema!`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
