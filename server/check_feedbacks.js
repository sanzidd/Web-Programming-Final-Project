const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/ruet-feedback');
  const Feedback = mongoose.connection.collection('feedbacks');
  
  const recentFeedbacks = await Feedback.find().sort({createdAt: -1}).limit(3).toArray();
  console.log("Recent Feedbacks:", JSON.stringify(recentFeedbacks, null, 2));
  
  process.exit(0);
}
run();
