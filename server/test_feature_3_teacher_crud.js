const mongoose = require('mongoose');
const Teacher = require('./models/Teacher');
const Department = require('./models/Department');
const { createTeacher, updateTeacher, deleteTeacher } = require('./controllers/teacherController');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruet-feedback';

async function runTests() {
  try {
    console.log('--- Starting Feature 3 Verification Tests (Teacher CRUD) ---');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    let dept = await Department.findOne({ code: 'ETE' });
    if (!dept) {
      dept = await Department.create({ name: 'Electronics & Telecommunication Engineering', code: 'ETE' });
    }

    // 1. Create Teacher
    const mockReqCreate = {
      body: {
        name: 'Dr. Test CRUD Teacher',
        designation: 'Assistant Professor',
        department: dept._id,
        email: 'testcrud@ete.ruet.ac.bd',
        courses: ['ETE 1101', 'ETE 1102']
      }
    };

    let statusCode = null;
    let responseData = null;
    const mockResCreate = {
      status: (code) => { statusCode = code; return { json: (d) => { responseData = d; } }; },
      json: (d) => { responseData = d; }
    };

    await createTeacher(mockReqCreate, mockResCreate);
    if (statusCode === 201 && responseData?.teacher?._id) {
      console.log('✅ Teacher created successfully via controller. ID:', responseData.teacher._id);
    } else {
      throw new Error(`Create teacher failed. Status: ${statusCode}, Data: ${JSON.stringify(responseData)}`);
    }

    const teacherId = responseData.teacher._id;

    // 2. Update Teacher
    const mockReqUpdate = {
      params: { id: teacherId },
      body: {
        designation: 'Associate Professor',
        courses: ['ETE 1101', 'ETE 1102', 'ETE 2101']
      }
    };
    statusCode = 200;
    responseData = null;
    const mockResUpdate = {
      status: (code) => { statusCode = code; return { json: (d) => { responseData = d; } }; },
      json: (d) => { responseData = d; }
    };

    await updateTeacher(mockReqUpdate, mockResUpdate);
    if (responseData?.teacher?.designation === 'Associate Professor' && responseData?.teacher?.courses?.length === 3) {
      console.log('✅ Teacher updated successfully via controller. Designation:', responseData.teacher.designation);
    } else {
      throw new Error(`Update teacher failed. Data: ${JSON.stringify(responseData)}`);
    }

    // 3. Delete Teacher
    const mockReqDelete = { params: { id: teacherId } };
    statusCode = 200;
    responseData = null;
    const mockResDelete = {
      status: (code) => { statusCode = code; return { json: (d) => { responseData = d; } }; },
      json: (d) => { responseData = d; }
    };

    await deleteTeacher(mockReqDelete, mockResDelete);
    const checkDeleted = await Teacher.findById(teacherId);
    if (!checkDeleted) {
      console.log('✅ Teacher deleted successfully via controller and verified removed from DB');
    } else {
      throw new Error('Teacher still exists in DB after deletion!');
    }

    console.log('\n--- 🎉 ALL FEATURE 3 TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

runTests();
