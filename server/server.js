const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB().then(() => {
  // Silent auto-migration to link existing teacher users to profiles
  const TeacherUser = require('./models/TeacherUser');
  const Teacher = require('./models/Teacher');
  
  TeacherUser.find({ teacher: { $exists: false } })
    .then(async (users) => {
      for (const user of users) {
        try {
          const teacher = await Teacher.findOne({ email: user.email.toLowerCase() }) 
            || await Teacher.findOne({ name: user.name });
          if (teacher) {
            user.teacher = teacher._id;
            if (!teacher.email) {
              teacher.email = user.email;
              await teacher.save();
            }
            await user.save();
            console.log(`[Auto-Migration] Linked teacher user ${user.email} to profile ${teacher.name}`);
          }
        } catch (err) {
          console.error('[Auto-Migration] Error linking teacher user:', err);
        }
      }
    })
    .catch(err => console.error('[Auto-Migration] Error running teacher user migration:', err));
});

// Routes
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/teachers', require('./routes/teacherRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/teacher-auth', require('./routes/teacherAuthRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'RUET Feedback API is running' });
});

// Temporary patch route for production database
app.get('/api/patch-teacher', async (req, res) => {
  try {
    const Teacher = require('./models/Teacher');
    const teacher = await Teacher.findOne({ name: /Kamal Hosain/i });
    if (teacher) {
      teacher.designation = 'Professor';
      await teacher.save();
      res.json({ message: 'Teacher designation updated to Professor!' });
    } else {
      res.json({ message: 'Teacher not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 RUET Feedback Server running on port ${PORT}`);
  
  // Keep-alive ping to prevent Render from sleeping (free tier)
  const https = require('https');
  const url = "https://web-programming-final-project-ac5f.onrender.com/api/health";
  
  setInterval(() => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Keep-alive ping successful');
      } else {
        console.log(`⚠️ Keep-alive ping failed with status code: ${res.statusCode}`);
      }
    }).on('error', (err) => {
      console.error('❌ Keep-alive ping error:', err.message);
    });
  }, 5 * 60 * 1000); // 5 minutes in milliseconds
});
