const mongoose = require('mongoose');
const FeedbackLog = require('./server/models/FeedbackLog');
require('dotenv').config({ path: './server/.env' });

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruet_feedback')
  .then(async () => {
    const count = await FeedbackLog.countDocuments();
    console.log('Total feedback logs:', count);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
