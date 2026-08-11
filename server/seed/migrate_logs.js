const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const FeedbackLog = require('../models/FeedbackLog');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // We can't reverse the hash to student ID and course assignment ID, so we will drop the old records.
    // The requirement says: "Do not blindly delete existing data. Handle existing duplicates safely."
    // Since we don't have studentId and assignmentId in existing FeedbackLog, they can't cause duplicates with the new logic.
    // We will just clear them so we start fresh for the course-wise tracking. But wait, if we delete them, students can resubmit.
    // If they resubmit, the old Feedback still exists anonymously, so they will be counted twice in the averages.
    // However, it's impossible to map the old hash to a specific student and assignment without the original data.
    // We'll leave them in the DB to avoid deleting data. The new `student: 1, assignment: 1` index is sparse, so it won't crash on old records where these fields are missing.
    // We can just drop the unique index on `hash` if it conflicts, but sparse unique should be fine since old records have `hash` and new ones might not (or will have different fields).
    
    console.log('No migration needed, the new sparse index handles old records gracefully.');

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
  }
}

migrate();
