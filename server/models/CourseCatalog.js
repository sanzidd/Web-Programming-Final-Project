const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const catalogOutcomeSchema = new mongoose.Schema({
  coNumber: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true }
}, { _id: false });

const courseCatalogSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, unique: true, trim: true },
  courseName: { type: String, required: true, trim: true },
  semester: { type: String, default: '1st Semester', trim: true },
  credits: { type: Number, default: null },
  departmentCode: { type: String, default: 'ETE', trim: true },
  courseOutcomes: { type: [catalogOutcomeSchema], default: [] }
}, { timestamps: true });

courseCatalogSchema.index({ semester: 1, courseCode: 1 });

/**
 * Idempotently seed all pre-enlisted courses & COs from OBE_book_Latest (obeCourses.json).
 * Uses $setOnInsert so any subsequent edits by Admin or Teachers in MongoDB are preserved.
 */
courseCatalogSchema.statics.ensureSeeded = async function () {
  const jsonPath = path.join(__dirname, '..', 'data', 'obeCourses.json');
  if (!fs.existsSync(jsonPath)) return;

  const rawCourses = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (!Array.isArray(rawCourses) || rawCourses.length === 0) return;

  const ops = rawCourses.map(c => ({
    updateOne: {
      filter: { courseCode: c.courseCode.trim() },
      update: {
        $setOnInsert: {
          courseCode: c.courseCode.trim(),
          courseName: c.courseName.trim(),
          semester: c.semester || '1st Semester',
          credits: c.credits ?? null,
          departmentCode: 'ETE',
          courseOutcomes: (c.courseOutcomes || []).map((co, idx) => ({
            coNumber: co.coNumber || idx + 1,
            title: (co.title || '').trim(),
            description: (co.description || '').trim()
          }))
        }
      },
      upsert: true
    }
  }));

  await this.bulkWrite(ops, { ordered: false });
};

module.exports = mongoose.model('CourseCatalog', courseCatalogSchema);

