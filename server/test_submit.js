const mongoose = require('mongoose');
const { submitFeedback } = require('./controllers/feedbackController');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/ruet-feedback');
  
  const req = {
    studentId: 'test_student_' + Date.now(),
    body: {
      department: "60d5ecb74d6bb892873a1111", // just a fake id, Mongoose might complain if it's not a valid ObjectId format
      teacher: "60d5ecb74d6bb892873a2222",
      courseName: "CSE 4101",
      courseContent: { q1: 5, q2: 5, q3: 5, comment: "" },
      studentContribution: { q5: 5, q6: 5, comment: "" },
      learningEnvironment: { q8: 5, q9: 5, q10: 5, q11: 5, comment: "" },
      learningResources: { q13: 5, q14: 5, q15: 5, comment: "" },
      courseTeacher: { q17: 5, q18: 5, q19: 5, q20: 5, q21: 5, q22: 5, comment: "" },
      courseRating: { structure: 5, delivery: 5, duration: 5, environment: 5, skill: 5, overall: 5, comment: "" },
      overallFeedback: "Great course!"
    }
  };
  
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log('Response Status:', this.statusCode);
      console.log('Response JSON:', data);
    }
  };
  
  try {
    await submitFeedback(req, res);
  } catch(e) {
    console.error(e);
  }
  
  process.exit(0);
}
test();
