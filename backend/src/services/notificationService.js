const Notification = require('../models/Notification');
const User = require('../models/User');
const {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  NOTIFICATION_AUDIENCE_TYPES,
  NOTIFICATION_CATEGORIES,
} = require('../constants/notifications');

const uniqIds = (ids = []) => [...new Set(ids.map((id) => id?.toString()).filter(Boolean))];

const buildPayload = (payload = {}) => ({
  title: payload.title,
  message: payload.message,
  type: payload.type || NOTIFICATION_TYPES.SYSTEM,
  priority: payload.priority || NOTIFICATION_PRIORITIES.MEDIUM,
  link: payload.link || '',
  meta: payload.meta || {},
  createdBy: payload.createdBy || null,
  recipientRole: payload.recipientRole || null,
  audienceType: payload.audienceType || NOTIFICATION_AUDIENCE_TYPES.USER,
  targetRoles: Array.isArray(payload.targetRoles) ? [...new Set(payload.targetRoles)] : [],
  targetUsers: Array.isArray(payload.targetUsers) ? [...new Set(payload.targetUsers.map((id) => id?.toString()).filter(Boolean))] : [],
  targetDepartments: Array.isArray(payload.targetDepartments)
    ? [...new Set(payload.targetDepartments.map((id) => id?.toString()).filter(Boolean))]
    : [],
  category: payload.category || NOTIFICATION_CATEGORIES.SYSTEM,
  groupKey: payload.groupKey || '',
  deliveryChannels: Array.isArray(payload.deliveryChannels) && payload.deliveryChannels.length ? payload.deliveryChannels : ['in_app'],
});

const notifyUsersByIds = async (userIds = [], payload = {}) => {
  const recipients = uniqIds(userIds);
  if (!recipients.length) return [];

  const users = await User.find({ _id: { $in: recipients }, deletedAt: null }).select('_id role departmentId').lean();
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  const docs = recipients.map((recipientUserId) => ({
    recipientUserId,
    ...buildPayload(payload),
    recipientRole: userMap.get(recipientUserId)?.role || payload.recipientRole || null,
    recipientDepartment: userMap.get(recipientUserId)?.departmentId || null,
  }));

  return Notification.insertMany(docs, { ordered: false });
};

const notifyUsersByQuery = async (query = {}, payload = {}) => {
  const users = await User.find({ deletedAt: null, ...query }).select('_id').lean();
  return notifyUsersByIds(users.map((user) => user._id), payload);
};

const notifyAudience = async (audience = {}, payload = {}) => {
  const {
    type = NOTIFICATION_AUDIENCE_TYPES.USER,
    targetRoles = [],
    targetUsers = [],
    targetDepartments = [],
    query = {},
  } = audience;

  if (type === NOTIFICATION_AUDIENCE_TYPES.GLOBAL) {
    const users = await User.find({ deletedAt: null }).select('_id').lean();
    return notifyUsersByIds(users.map((user) => user._id), {
      ...payload,
      audienceType: NOTIFICATION_AUDIENCE_TYPES.GLOBAL,
      targetRoles,
      targetUsers,
      targetDepartments,
    });
  }

  if (type === NOTIFICATION_AUDIENCE_TYPES.ROLE) {
    const users = await User.find({
      deletedAt: null,
      role: { $in: targetRoles.length ? targetRoles : ['ADMIN', 'MANAGER', 'DOCTOR'] },
      ...(targetDepartments.length ? { departmentId: { $in: targetDepartments } } : {}),
      ...query,
    }).select('_id role departmentId').lean();

    return notifyUsersByIds(users.map((user) => user._id), {
      ...payload,
      audienceType: NOTIFICATION_AUDIENCE_TYPES.ROLE,
      targetRoles,
      targetUsers,
      targetDepartments,
    });
  }

  return notifyUsersByIds(targetUsers, {
    ...payload,
    audienceType: NOTIFICATION_AUDIENCE_TYPES.USER,
    targetRoles,
    targetUsers,
    targetDepartments,
  });
};

module.exports = {
  notifyUsersByIds,
  notifyUsersByQuery,
  notifyAudience,
};
