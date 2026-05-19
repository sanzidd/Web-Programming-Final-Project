const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/ruet-feedback');
  const FeedbackLog = mongoose.connection.collection('feedbacklogs');
  
  const logs = await FeedbackLog.find({}).toArray();
  console.log("FeedbackLogs:", logs);
  
  process.exit(0);
}
run();
