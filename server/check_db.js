const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/ruet-feedback');
  const FeedbackLog = mongoose.connection.collection('feedbacklogs');
  const Feedback = mongoose.connection.collection('feedbacks');
  
  const logsCount = await FeedbackLog.countDocuments();
  const feedbacksCount = await Feedback.countDocuments();
  
  console.log(`Logs: ${logsCount}`);
  console.log(`Feedbacks: ${feedbacksCount}`);
  
  process.exit(0);
}
run();
