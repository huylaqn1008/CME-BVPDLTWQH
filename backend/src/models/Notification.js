const mongoose = require('mongoose');
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_AUDIENCE_TYPES,
  NOTIFICATION_CATEGORIES,
} = require('../constants/notifications');

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientRole: { type: String, enum: ['ADMIN', 'MANAGER', 'DOCTOR'], default: null },
    recipientDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    audienceType: {
      type: String,
      enum: Object.values(NOTIFICATION_AUDIENCE_TYPES),
      default: NOTIFICATION_AUDIENCE_TYPES.USER,
      index: true,
    },
    targetRoles: {
      type: [String],
      default: [],
    },
    targetUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    targetDepartments: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    category: {
      type: String,
      enum: Object.values(NOTIFICATION_CATEGORIES),
      default: NOTIFICATION_CATEGORIES.SYSTEM,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      default: 'SYSTEM',
    },
    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITIES),
      default: NOTIFICATION_PRIORITIES.MEDIUM,
      index: true,
    },
    link: { type: String, default: '' },
    meta: { type: Object, default: {} },
    groupKey: { type: String, default: '', index: true },
    deliveryChannels: { type: [String], default: ['in_app'] },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientUserId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ audienceType: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
