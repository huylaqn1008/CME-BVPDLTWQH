const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cmeRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'CMERecord', required: true },
    issueDate: { type: Date, default: Date.now },
    certificateNumber: { type: String, required: true, unique: true },
    fileUrl: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Certificate', certificateSchema);
