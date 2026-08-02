const mongoose = require('mongoose');
const ReviewSession = require('./models/ReviewSession');
const { submitFeedback } = require('./controllers/feedbackController');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruet-feedback';

async function runTests() {
  try {
    console.log('--- Starting Feature 2 Verification Tests (Review Session) ---');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Get current session
    const session = await ReviewSession.getCurrentSession();
    console.log('✅ Initial Session status fetched. ID:', session._id, '| isOpen:', session.isOpen);

    // 2. Toggle session to CLOSED
    session.isOpen = false;
    session.closedMessage = 'Test closed message: Review period has ended.';
    await session.save();
    console.log('✅ Session toggled to CLOSED in database');

    // 3. Verify submitFeedback rejects submission when session is closed
    const mockReqClosed = {
      body: {
        teacher: '5f8d04b3b54764421b7156c1',
        department: '5f8d04b3b54764421b7156c2',
        courseName: 'ETE 3101',
        courseContent: { q1: 5, q2: 5, q3: 5 },
        studentContribution: { q5: 5, q6: 5 },
        learningEnvironment: { q8: 5, q9: 5, q10: 5, q11: 5 },
        learningResources: { q13: 5, q14: 5, q15: 5 },
        courseTeacher: { q17: 5, q18: 5, q19: 5, q20: 5, q21: 5, q22: 5 },
        courseRating: { structure: 5, delivery: 5, duration: 5, environment: 5, skill: 5, overall: 5, comment: 'Great' },
        overallFeedback: 'Excellent'
      }
    };

    let statusCode = null;
    let responseData = null;
    const mockResClosed = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          }
        };
      },
      json: (data) => {
        responseData = data;
      }
    };

    await submitFeedback(mockReqClosed, mockResClosed);

    if (statusCode === 403 && responseData?.isClosed === true) {
      console.log('✅ submitFeedback correctly rejected submission when session CLOSED (Status 403)');
      console.log('   Message returned:', responseData.message);
    } else {
      throw new Error(`Expected 403 isClosed:true, got status ${statusCode} and data: ${JSON.stringify(responseData)}`);
    }

    // 4. Toggle session back to OPEN
    session.isOpen = true;
    await session.save();
    console.log('✅ Session toggled back to OPEN in database');

    // 5. Verify submitFeedback does NOT fail with 403 when session is OPEN
    statusCode = 200; // default
    responseData = null;
    const mockResOpen = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          }
        };
      },
      json: (data) => {
        responseData = data;
      }
    };

    // We pass invalid body just to check it gets past the isOpen check (e.g. should fail validation or studentId check, not 403 isClosed)
    await submitFeedback({ body: {} }, mockResOpen);
    if (statusCode !== 403 || responseData?.isClosed !== true) {
      console.log('✅ submitFeedback allowed check to pass when session OPEN (Did not return 403 isClosed)');
    } else {
      throw new Error('submitFeedback still returned 403 isClosed when session was set to OPEN');
    }

    console.log('\n--- 🎉 ALL FEATURE 2 TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

runTests();
