const mongoose = require('mongoose');

const approvalHistorySchema = new mongoose.Schema(
  {
    cmeRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'CMERecord', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['ADMIN', 'MANAGER'], required: true },
    status: { type: String, enum: ['pending', 'manager_approved', 'admin_approved', 'rejected'], required: true },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ApprovalHistory', approvalHistorySchema);
