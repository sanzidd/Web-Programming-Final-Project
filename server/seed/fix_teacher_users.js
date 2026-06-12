const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ruet-feedback';

async function migrate() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    const TeacherUser = require('../models/TeacherUser');
    const Teacher = require('../models/Teacher');

    const users = await TeacherUser.find({});
    console.log(`Found ${users.length} teacher users. Checking for missing links...`);

    let fixedCount = 0;
    for (const user of users) {
      if (!user.teacher) {
        console.log(`User ${user.email} is missing a teacher link. Attempting to match...`);
        const teacher = await Teacher.findOne({ email: user.email.toLowerCase() });
        if (teacher) {
          user.teacher = teacher._id;
          await user.save();
          console.log(`Successfully linked ${user.email} to teacher profile ${teacher.name} (${teacher._id})`);
          fixedCount++;
        } else {
          // If no matching profile by email, try matching by name
          const teacherByName = await Teacher.findOne({ name: user.name });
          if (teacherByName) {
            user.teacher = teacherByName._id;
            // Also update the teacher's email since it's now linked to this user
            if (!teacherByName.email) {
              teacherByName.email = user.email;
              await teacherByName.save();
            }
            await user.save();
            console.log(`Successfully linked ${user.email} to teacher profile ${teacherByName.name} (${teacherByName._id}) by name`);
            fixedCount++;
          } else {
            console.log(`Could not find a teacher profile for ${user.email} (${user.name})`);
          }
        }
      } else {
        console.log(`User ${user.email} is already linked to teacher ${user.teacher}`);
      }
    }

    console.log(`Migration completed. Fixed/linked ${fixedCount} users.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
