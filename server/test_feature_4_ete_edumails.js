const mongoose = require('mongoose');
const Teacher = require('./models/Teacher');
const Department = require('./models/Department');
const TeacherUser = require('./models/TeacherUser');
const { ETE_TEACHERS } = require('./seed/update_ete_edumails');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruet-feedback';

async function runTests() {
  try {
    console.log('--- Starting Feature 4 Verification Tests (ETE Edumails Migration) ---');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const dept = await Department.findOne({ code: 'ETE' });
    if (!dept) {
      throw new Error('ETE Department not found in database!');
    }

    // 1. Check all ETE teachers in Teacher collection
    const teachers = await Teacher.find({ department: dept._id });
    console.log(`✅ Found ${teachers.length} ETE teachers in database.`);

    if (teachers.length < ETE_TEACHERS.length) {
      throw new Error(`Expected at least ${ETE_TEACHERS.length} ETE teachers, got ${teachers.length}`);
    }

    let validEmailCount = 0;
    for (const t of teachers) {
      if (t.email && t.email.endsWith('@ete.ruet.ac.bd')) {
        validEmailCount++;
      }
    }
    console.log(`✅ Verified ${validEmailCount} ETE teachers have valid @ete.ruet.ac.bd edumails.`);
    if (validEmailCount < ETE_TEACHERS.length) {
      throw new Error(`Expected at least ${ETE_TEACHERS.length} valid ETE edumails, got ${validEmailCount}`);
    }

    // 2. Verify TeacherUser auth accounts and password comparison
    let authVerifiedCount = 0;
    for (const expected of ETE_TEACHERS) {
      const authUser = await TeacherUser.findOne({ email: expected.email });
      if (!authUser) {
        throw new Error(`TeacherUser auth account missing for email: ${expected.email}`);
      }
      if (!authUser.isVerified) {
        throw new Error(`TeacherUser is not verified for email: ${expected.email}`);
      }
      if (!authUser.forcePasswordChange) {
        throw new Error(`TeacherUser forcePasswordChange is not true for email: ${expected.email}`);
      }
      if (!authUser.teacher) {
        throw new Error(`Teacher profile reference missing in TeacherUser for email: ${expected.email}`);
      }

      // Check password matching default '12345678'
      const isMatch = await authUser.comparePassword('12345678');
      if (!isMatch) {
        throw new Error(`Default password '12345678' failed verification for email: ${expected.email}`);
      }
      authVerifiedCount++;
    }

    console.log(`✅ Verified ${authVerifiedCount} TeacherUser auth accounts are correctly linked, verified, forcePasswordChange=true, and match default password "12345678".`);
    console.log('\n--- 🎉 ALL FEATURE 4 TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

runTests();
