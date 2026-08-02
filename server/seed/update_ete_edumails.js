const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const Department = require('../models/Department');
const TeacherUser = require('../models/TeacherUser');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruet-feedback';

const ETE_TEACHERS = [
  { name: "Dr. Md. Kamal Hosain", designation: "Professor", email: "kamal@ete.ruet.ac.bd" },
  { name: "Dr Md Munjure Mowla", designation: "Professor", email: "mowla@ete.ruet.ac.bd" },
  { name: "Dr. Mst. Fateha Samad", designation: "Professor", email: "fateha@ete.ruet.ac.bd" },
  { name: "Dr. Shah Ariful Hoque Chowdhury", designation: "Professor", email: "ariful@ete.ruet.ac.bd" },
  { name: "Dr. Tushar Kanti Roy", designation: "Associate Professor", email: "tushar@ete.ruet.ac.bd" },
  { name: "Dr. Md Rabiul Hasan", designation: "Associate Professor", email: "rabiul@ete.ruet.ac.bd" },
  { name: "JANNATUL ROBAIAT MOU", designation: "Assistant Professor", email: "mou@ete.ruet.ac.bd" },
  { name: "Sham Datto", designation: "Assistant Professor", email: "sham@ete.ruet.ac.bd" },
  { name: "Md. Aslam Mollah", designation: "Assistant Professor", email: "aslam@ete.ruet.ac.bd" },
  { name: "A. S. M. Badrudduza", designation: "Assistant Professor", email: "badrudduza@ete.ruet.ac.bd" },
  { name: "Md. Yeakub Ali", designation: "Assistant Professor", email: "yeakub@ete.ruet.ac.bd" },
  { name: "Md. Rakib Hossain", designation: "Assistant Professor", email: "rakib@ete.ruet.ac.bd" },
  { name: "Shuvra Prokash Biswas", designation: "Assistant Professor", email: "shuvra@ete.ruet.ac.bd" },
  { name: "Hasan Sarker", designation: "Assistant Professor", email: "hasan@ete.ruet.ac.bd" },
  { name: "Farzana Akter", designation: "Assistant Professor", email: "farzana@ete.ruet.ac.bd" },
  { name: "Md Abu Ismail Siddique", designation: "Assistant Professor", email: "ismail@ete.ruet.ac.bd" },
  { name: "Sharaf Tasnim", designation: "Assistant Professor", email: "sharaf@ete.ruet.ac.bd" },
  { name: "Md. Tarek Hassan", designation: "Lecturer", email: "tarek@ete.ruet.ac.bd" },
  { name: "Mohammed Nazmul Islam Nahin", designation: "Lecturer", email: "nahin@ete.ruet.ac.bd" },
  { name: "Rubaeat Ahammed", designation: "Lecturer", email: "rubaeat@ete.ruet.ac.bd" },
  { name: "Rifa Tabassum Mim", designation: "Lecturer", email: "mim@ete.ruet.ac.bd" }
];

async function updateEteEdumails() {
  try {
    console.log('--- Starting Migration: Update ETE Teachers with RUET Edumails ---');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    let dept = await Department.findOne({ code: 'ETE' });
    if (!dept) {
      dept = await Department.create({ name: 'Electronics & Telecommunication Engineering', code: 'ETE' });
      console.log('✅ Created ETE Department');
    }

    let updatedCount = 0;
    let authAccountCount = 0;

    for (const t of ETE_TEACHERS) {
      // Find Teacher by name or email or create if missing
      let teacherDoc = await Teacher.findOne({ 
        department: dept._id, 
        name: { $regex: new RegExp(`^${t.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') } 
      });

      if (!teacherDoc) {
        teacherDoc = new Teacher({
          name: t.name,
          designation: t.designation,
          department: dept._id,
          courses: []
        });
      }

      teacherDoc.email = t.email;
      teacherDoc.designation = t.designation;
      await teacherDoc.save();
      updatedCount++;

      // Create or update TeacherUser auth account with default password '12345678'
      let teacherUser = await TeacherUser.findOne({ email: t.email });
      if (!teacherUser) {
        teacherUser = new TeacherUser({
          name: t.name,
          email: t.email,
          password: '12345678',
          department: dept._id,
          designation: t.designation,
          teacher: teacherDoc._id,
          isVerified: true,
          forcePasswordChange: true
        });
        await teacherUser.save();
        authAccountCount++;
      } else {
        teacherUser.teacher = teacherDoc._id;
        teacherUser.department = dept._id;
        teacherUser.designation = t.designation;
        teacherUser.isVerified = true;
        // If password was already changed, we don't force, but if it's default we make sure
        await teacherUser.save();
      }
    }

    console.log(`✅ Successfully updated ${updatedCount} ETE teacher profiles with authentic RUET edumails.`);
    console.log(`✅ Linked/created ${authAccountCount} TeacherUser auth accounts with default password "12345678".`);
    console.log('--- 🎉 ETE EDUMAIL MIGRATION COMPLETED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

if (require.main === module) {
  updateEteEdumails();
}

module.exports = { updateEteEdumails, ETE_TEACHERS };
