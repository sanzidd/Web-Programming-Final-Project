const mongoose = require('mongoose');
const Department = require('../models/Department');
const Teacher = require('../models/Teacher');
const Admin = require('../models/Admin');
const Feedback = require('../models/Feedback');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ruet-feedback';

const teachersByDept = require('./teachers_data.json');

const departments = [
  { name: 'Computer Science & Engineering', code: 'CSE', faculty: 'Electrical and Computer Engineering' },
  { name: 'Electrical & Electronic Engineering', code: 'EEE', faculty: 'Electrical and Computer Engineering' },
  { name: 'Electrical & Computer Engineering', code: 'ECE', faculty: 'Electrical and Computer Engineering' },
  { name: 'Electronics & Telecommunication Engineering', code: 'ETE', faculty: 'Electrical and Computer Engineering' },
  { name: 'Mechanical Engineering', code: 'ME', faculty: 'Mechanical Engineering' },
  { name: 'Industrial & Production Engineering', code: 'IPE', faculty: 'Mechanical Engineering' },
  { name: 'Mechatronics Engineering', code: 'MTE', faculty: 'Mechanical Engineering' },
  { name: 'Materials Science & Engineering', code: 'MSE', faculty: 'Mechanical Engineering' },
  { name: 'Chemical Engineering', code: 'CHE', faculty: 'Mechanical Engineering' },
  { name: 'Ceramic & Metallurgical Engineering', code: 'CME', faculty: 'Mechanical Engineering' },
  { name: 'Civil Engineering', code: 'CE', faculty: 'Civil Engineering' },
  { name: 'Urban & Regional Planning', code: 'URP', faculty: 'Civil Engineering' },
  { name: 'Building Engineering & Construction Management', code: 'BECM', faculty: 'Civil Engineering' },
  { name: 'Architecture', code: 'ARCH', faculty: 'Civil Engineering' },
  { name: 'Mathematics', code: 'MATH', faculty: 'Applied Science and Engineering' },
  { name: 'Chemistry', code: 'CHEM', faculty: 'Applied Science and Engineering' },
  { name: 'Physics', code: 'PHY', faculty: 'Applied Science and Engineering' },
  { name: 'Humanities', code: 'HUM', faculty: 'Applied Science and Engineering' },
];

// Sample comments for generating seed feedbacks
const sampleComments = {
  positive: [
    'Excellent teaching methodology. Very clear explanations.',
    'One of the best teachers at RUET. Highly recommended!',
    'Always available for consultation. Very helpful and supportive.',
    'Makes complex topics easy to understand. Great use of examples.',
    'Engaging lectures with practical demonstrations. Outstanding!',
    'Very knowledgeable and passionate about the subject.',
    'Fair grading system and well-organized course materials.',
    'Inspiring teacher who motivates students to learn more.',
  ],
  neutral: [
    'Average teaching. Could improve with more practical examples.',
    'Decent lectures but sometimes hard to follow the pace.',
    'Course content is good but delivery could be better.',
    'Okay overall. Has both strengths and weaknesses.',
    'Moderate teaching quality. Some topics are well covered.',
  ],
  negative: [
    'Lectures are boring and lack engagement.',
    'Difficult to understand the concepts from the lectures.',
    'Not very approachable for doubts and questions.',
    'Poor time management during classes.',
    'Unfair grading practices. Needs improvement.',
  ],
};

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      Department.deleteMany({}),
      Teacher.deleteMany({}),
      Admin.deleteMany({}),
      Feedback.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create departments
    const createdDepts = {};
    for (const dept of departments) {
      const created = await Department.create(dept);
      createdDepts[dept.code] = created;
    }
    console.log(`Created ${departments.length} departments`);

    // Create teachers
    const allTeachers = [];
    for (const [deptCode, teachers] of Object.entries(teachersByDept)) {
      const dept = createdDepts[deptCode];
      for (const teacher of teachers) {
        const created = await Teacher.create({
          ...teacher,
          department: dept._id,
        });
        allTeachers.push(created);
      }
    }
    console.log(`Created ${allTeachers.length} teachers`);

    // Create admin
    await Admin.create({
      username: 'admin',
      password: 'ruet2026',
      role: 'admin',
    });
    console.log('Created admin user (admin / ruet2026)');

    // Generate sample feedbacks
    let feedbackCount = 0;
    for (const teacher of allTeachers) {
      const numFeedbacks = Math.floor(Math.random() * 12) + 3; // 3-14 feedbacks per teacher

      for (let i = 0; i < numFeedbacks; i++) {
        const rating = Math.floor(Math.random() * 5) + 1;
        const teaching = Math.max(1, Math.min(5, rating + Math.floor(Math.random() * 3) - 1));
        const comm = Math.max(1, Math.min(5, rating + Math.floor(Math.random() * 3) - 1));
        const help = Math.max(1, Math.min(5, rating + Math.floor(Math.random() * 3) - 1));

        let sentimentType, commentPool;
        if (rating >= 4) {
          sentimentType = 'positive';
          commentPool = sampleComments.positive;
        } else if (rating >= 3) {
          sentimentType = 'neutral';
          commentPool = sampleComments.neutral;
        } else {
          sentimentType = 'negative';
          commentPool = sampleComments.negative;
        }

        const comment = Math.random() > 0.3
          ? commentPool[Math.floor(Math.random() * commentPool.length)]
          : '';

        // Random date in last 6 months
        const daysAgo = Math.floor(Math.random() * 180);
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        await Feedback.create({
          teacher: teacher._id,
          department: teacher.department,
          courseName: (teacher.courses && teacher.courses.length > 0) 
            ? teacher.courses[Math.floor(Math.random() * teacher.courses.length)] 
            : 'General Course',
          
          courseContent: { q1: teaching, q2: teaching, q3: teaching, comment: '' },
          studentContribution: { q5: comm, q6: comm, comment: '' },
          learningEnvironment: { q8: help, q9: help, q10: help, q11: help, comment: '' },
          learningResources: { q13: teaching, q14: teaching, q15: teaching, comment: '' },
          courseTeacher: { 
            q17: comm, q18: teaching, q19: teaching, 
            q20: comm, q21: comm, q22: help, comment: '' 
          },
          courseRating: { 
            structure: teaching, delivery: teaching, duration: comm, 
            environment: help, skill: teaching, overall: rating, comment: '' 
          },
          overallFeedback: comment || 'Good course',
          sentiment: sentimentType,
          createdAt,
        });
        feedbackCount++;
      }

      // Update teacher averages
      const feedbacks = await Feedback.find({ teacher: teacher._id });
      const count = feedbacks.length;
      if (count > 0) {
        await Teacher.findByIdAndUpdate(teacher._id, {
          avgRating: Math.round((feedbacks.reduce((s, f) => s + f.courseRating.overall, 0) / count) * 100) / 100,
          avgTeaching: Math.round((feedbacks.reduce((s, f) => s + f.courseTeacher.q19, 0) / count) * 100) / 100,
          avgCommunication: Math.round((feedbacks.reduce((s, f) => s + f.courseTeacher.q21, 0) / count) * 100) / 100,
          avgHelpfulness: Math.round((feedbacks.reduce((s, f) => s + f.courseTeacher.q17, 0) / count) * 100) / 100,
          totalFeedbacks: count,
        });
      }
    }
    console.log(`Created ${feedbackCount} sample feedbacks`);

    console.log('\n✅ Seed completed successfully!');
    console.log('Admin Login: admin / ruet2026');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
