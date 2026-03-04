const mongoose = require('mongoose');

const cmeRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['internal', 'external'], required: true },
    points: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'manager_approved', 'admin_approved', 'rejected'], default: 'pending' },
    evidenceFile: { type: String, default: null },
    certificateFile: { type: String, default: null },
    note: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CMERecord', cmeRecordSchema);
