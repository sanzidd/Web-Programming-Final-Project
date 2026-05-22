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
connectDB();

// Routes
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/teachers', require('./routes/teacherRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));

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
});
