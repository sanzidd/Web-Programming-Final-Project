const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/ruet-feedback');
  const Teacher = mongoose.connection.collection('teachers');
  
  const teachersCount = await Teacher.countDocuments();
  console.log(`Total Teachers: ${teachersCount}`);
  
  process.exit(0);
}
run();
