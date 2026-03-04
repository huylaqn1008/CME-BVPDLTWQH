const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    cmePoints: { type: Number, required: true, min: 0 },
    applicableDepartments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    submissionStatus: {
      type: String,
      enum: ['OPEN', 'SUBMISSION_OPEN', 'CLOSED'],
      default: 'OPEN',
    },
    startDate: { type: Date },
    endDate: { type: Date },
    attachments: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
