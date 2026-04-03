const CMERecord = require('../models/CMERecord');
const Course = require('../models/Course');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { notifyAudience } = require('../services/notificationService');
const {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  NOTIFICATION_AUDIENCE_TYPES,
  NOTIFICATION_CATEGORIES,
} = require('../constants/notifications');

const inferCategoryFromType = (type) => {
  if ([NOTIFICATION_TYPES.COURSE_CREATED, NOTIFICATION_TYPES.COURSE_UPDATED, NOTIFICATION_TYPES.COURSE_DEADLINE].includes(type)) {
    return NOTIFICATION_CATEGORIES.LEARNING;
  }
  if ([NOTIFICATION_TYPES.RECORD_SUBMITTED, NOTIFICATION_TYPES.RECORD_REVIEWED, NOTIFICATION_TYPES.RECORD_REJECTED, NOTIFICATION_TYPES.RECORD_APPROVED, NOTIFICATION_TYPES.FINAL_APPROVAL_PENDING].includes(type)) {
    return NOTIFICATION_CATEGORIES.APPROVAL;
  }
  if ([NOTIFICATION_TYPES.WEEKLY_SUMMARY, NOTIFICATION_TYPES.REPORT].includes(type)) {
    return NOTIFICATION_CATEGORIES.REPORT;
  }
  if ([NOTIFICATION_TYPES.SYSTEM_ALERT, NOTIFICATION_TYPES.AUDIT_ALERT, NOTIFICATION_TYPES.PASSWORD_RESET_REQUEST].includes(type)) {
    return NOTIFICATION_CATEGORIES.SECURITY;
  }
  if ([NOTIFICATION_TYPES.DOCTOR_ADDED, NOTIFICATION_TYPES.ACCOUNT_CREATED, NOTIFICATION_TYPES.BULK_IMPORT_COMPLETED].includes(type)) {
    return NOTIFICATION_CATEGORIES.ADMIN;
  }
  return NOTIFICATION_CATEGORIES.SYSTEM;
};

const priorityBucket = (priority) => {
  if (priority === NOTIFICATION_PRIORITIES.CRITICAL) return 'critical';
  if (priority === NOTIFICATION_PRIORITIES.HIGH || priority === NOTIFICATION_PRIORITIES.MEDIUM) return 'warning';
  return 'info';
};

const matchesText = (value = '', query = '') => {
  if (!query) return true;
  return String(value).toLowerCase().includes(String(query).toLowerCase());
};

const formatReminder = (
  id,
  title,
  message,
  link,
  type = NOTIFICATION_TYPES.REMINDER,
  priority = NOTIFICATION_PRIORITIES.MEDIUM,
  category = NOTIFICATION_CATEGORIES.SYSTEM
) => ({
  _id: id,
  title,
  message,
  link,
  type,
  priority,
  category: category || inferCategoryFromType(type),
  audienceType: NOTIFICATION_AUDIENCE_TYPES.USER,
  isRead: false,
  createdAt: new Date(),
  virtual: true,
});

const matchesReminderFilters = (item, filters) => {
  const {
    q = '',
    type = 'all',
    category = 'all',
    priority = 'all',
    audienceType = 'all',
    role = 'all',
  } = filters;

  if (type !== 'all' && item.type !== type) return false;
  if (category !== 'all' && item.category !== category) return false;
  if (priority !== 'all' && item.priority !== priority) return false;
  if (audienceType !== 'all' && (item.audienceType || 'USER') !== audienceType) return false;
  if (role !== 'all' && item.recipientRole && role !== item.recipientRole) return false;
  return matchesText(`${item.title} ${item.message}`, q);
};

const buildDoctorScopeFilter = (doctor) => {
  if (!doctor?.departmentId) {
    return {
      $or: [{ applicableDepartments: { $exists: false } }, { applicableDepartments: { $size: 0 } }],
    };
  }

  return {
    $or: [
      { applicableDepartments: { $exists: false } },
      { applicableDepartments: { $size: 0 } },
      { applicableDepartments: doctor.departmentId },
    ],
  };
};

const getReminders = async (user) => {
  if (user.role === 'ADMIN') {
    const [pendingRecords, lowPointUsers, expiringCourses] = await Promise.all([
      CMERecord.countDocuments({ status: 'pending', deletedAt: null }),
      CMERecord.aggregate([
        { $match: { status: 'admin_approved', deletedAt: null } },
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
        { $match: { total: { $lt: 24 } } },
        { $count: 'count' },
      ]),
      Course.countDocuments({
        deletedAt: null,
        endDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    const reminders = [];
    if (pendingRecords > 0) {
      reminders.push(
        formatReminder(
          `admin-pending-${pendingRecords}`,
          'Hồ sơ CME đang chờ xử lý',
          `Hiện có ${pendingRecords} hồ sơ đang chờ duyệt trong hệ thống.`,
          '/approvals',
          NOTIFICATION_TYPES.FINAL_APPROVAL_PENDING,
          NOTIFICATION_PRIORITIES.HIGH
        )
      );
    }
    const missingCount = lowPointUsers[0]?.count || 0;
    if (missingCount > 0) {
      reminders.push(
        formatReminder(
          `admin-low-points-${missingCount}`,
          'Bác sĩ chưa đủ điểm CME',
          `Có ${missingCount} bác sĩ đang thiếu điểm CME trong năm hiện tại.`,
          '/',
          NOTIFICATION_TYPES.REMINDER,
          NOTIFICATION_PRIORITIES.MEDIUM
        )
      );
    }
    if (expiringCourses > 0) {
      reminders.push(
        formatReminder(
          `admin-expiring-courses-${expiringCourses}`,
          'Khóa học sắp hết hạn',
          `Có ${expiringCourses} khóa học sắp đến hạn đóng trong 7 ngày tới.`,
          '/courses',
          NOTIFICATION_TYPES.COURSE_DEADLINE,
          NOTIFICATION_PRIORITIES.HIGH
        )
      );
    }

    const [finalApprovalPending, monthlyReport, unusualAuditCount] = await Promise.all([
      CMERecord.countDocuments({ status: 'manager_approved', deletedAt: null }),
      CMERecord.aggregate([
        {
          $match: {
            status: 'admin_approved',
            deletedAt: null,
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
        { $group: { _id: null, totalPoints: { $sum: '$points' }, totalRecords: { $sum: 1 } } },
      ]),
      AuditLog.countDocuments({
        action: { $in: ['SOFT_DELETE_USER', 'UPDATE_USER'] },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    if (finalApprovalPending > 0) {
      reminders.push(
        formatReminder(
          `admin-final-approval-${finalApprovalPending}`,
          'Chứng chỉ chờ duyệt cuối cùng',
          `Có ${finalApprovalPending} hồ sơ đang chờ admin phê duyệt cuối cùng.`,
          '/approvals',
          NOTIFICATION_TYPES.FINAL_APPROVAL_PENDING
        )
      );
    }

    if ((monthlyReport[0]?.totalRecords || 0) > 0 && new Date().getDate() === 1) {
      reminders.push(
        formatReminder(
          `admin-monthly-report-${new Date().getMonth() + 1}`,
          'Báo cáo hàng tháng hệ thống',
          `Tháng này hệ thống đã duyệt ${monthlyReport[0]?.totalRecords || 0} hồ sơ với tổng ${monthlyReport[0]?.totalPoints || 0} điểm.`,
          '/',
          NOTIFICATION_TYPES.REPORT,
          NOTIFICATION_PRIORITIES.LOW
        )
      );
    }

    if (unusualAuditCount > 0) {
      reminders.push(
        formatReminder(
          `admin-audit-alert-${unusualAuditCount}`,
          'Audit log bất thường',
          `Có ${unusualAuditCount} hành động cần kiểm tra trong 24 giờ qua.`,
          '/activities',
          NOTIFICATION_TYPES.AUDIT_ALERT,
          NOTIFICATION_PRIORITIES.CRITICAL
        )
      );
    }
    return reminders;
  }

  if (user.role === 'MANAGER') {
    const doctors = await User.find({ deletedAt: null, role: 'DOCTOR', departmentId: user.departmentId }).select('_id');
    const doctorIds = doctors.map((doctor) => doctor._id);
    const [pendingRecords, lackingDoctors] = await Promise.all([
      CMERecord.countDocuments({ deletedAt: null, status: 'pending', userId: { $in: doctorIds } }),
      CMERecord.aggregate([
        { $match: { deletedAt: null, status: 'admin_approved', userId: { $in: doctorIds } } },
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
        { $match: { total: { $lt: 24 } } },
        { $count: 'count' },
      ]),
    ]);

    const reminders = [];
    if (pendingRecords > 0) {
      reminders.push(
        formatReminder(
          `manager-pending-${pendingRecords}`,
          'Hồ sơ chờ duyệt trong khoa',
          `Khoa/phòng của bạn đang có ${pendingRecords} hồ sơ cần xử lý.`,
          '/approvals',
          NOTIFICATION_TYPES.RECORD_SUBMITTED,
          NOTIFICATION_PRIORITIES.HIGH
        )
      );
    }
    const lackingCount = lackingDoctors[0]?.count || 0;
    if (lackingCount > 0) {
      reminders.push(
        formatReminder(
          `manager-lacking-${lackingCount}`,
          'Bác sĩ thiếu điểm CME',
          `Có ${lackingCount} bác sĩ trong khoa chưa đạt chuẩn CME.`,
          '/department-doctors',
          NOTIFICATION_TYPES.REMINDER,
          NOTIFICATION_PRIORITIES.MEDIUM
        )
      );
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    const [overdue3Days, overdue5Days, weeklyApprovedCount, weeklyRejectedCount] = await Promise.all([
      CMERecord.countDocuments({
        deletedAt: null,
        status: 'pending',
        userId: { $in: doctorIds },
        createdAt: { $lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      }),
      CMERecord.countDocuments({
        deletedAt: null,
        status: 'pending',
        userId: { $in: doctorIds },
        createdAt: { $lte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      }),
      CMERecord.countDocuments({
        deletedAt: null,
        status: 'manager_approved',
        userId: { $in: doctorIds },
        updatedAt: { $gte: weekStart },
      }),
      CMERecord.countDocuments({
        deletedAt: null,
        status: 'rejected',
        userId: { $in: doctorIds },
        updatedAt: { $gte: weekStart },
      }),
    ]);

    if (overdue3Days > 0) {
      reminders.push(
        formatReminder(
          `manager-overdue-3-${overdue3Days}`,
          'Chứng chỉ quá hạn chưa duyệt',
          `Có ${overdue3Days} hồ sơ đã chờ hơn 3 ngày.`,
          '/approvals',
          NOTIFICATION_TYPES.REMINDER,
          NOTIFICATION_PRIORITIES.HIGH
        )
      );
    }

    if (overdue5Days > 0) {
      reminders.push(
        formatReminder(
          `manager-overdue-5-${overdue5Days}`,
          'Chứng chỉ quá hạn kéo dài',
          `Có ${overdue5Days} hồ sơ đã chờ hơn 5 ngày, cần ưu tiên xử lý.`,
          '/approvals',
          NOTIFICATION_TYPES.REMINDER,
          NOTIFICATION_PRIORITIES.CRITICAL
        )
      );
    }

    if (new Date().getDay() === 1) {
      reminders.push(
        formatReminder(
          `manager-weekly-${user.departmentId?.toString() || 'dept'}`,
          'Báo cáo hàng tuần khoa/phòng',
          `Khoa/phòng đang có ${pendingRecords} hồ sơ chờ duyệt, ${weeklyApprovedCount} hồ sơ đã duyệt tuần này và ${lackingCount} bác sĩ thiếu điểm.`,
          '/department-doctors',
          NOTIFICATION_TYPES.WEEKLY_SUMMARY,
          NOTIFICATION_PRIORITIES.LOW
        )
      );
    }
    return reminders;
  }

  const [pending, approvedRecords, suggestedCourses] = await Promise.all([
    CMERecord.countDocuments({ userId: user._id, status: 'pending', deletedAt: null }),
    CMERecord.find({ userId: user._id, status: 'admin_approved', deletedAt: null }).select('points'),
    Course.find({
      deletedAt: null,
      applicableDepartments: user.departmentId,
      submissionStatus: { $in: ['OPEN', 'SUBMISSION_OPEN'] },
      endDate: { $gt: new Date() },
    }).select('_id title cmePoints').limit(5),
  ]);

  const totalPoints = approvedRecords.reduce((sum, record) => sum + Number(record.points || 0), 0);
  const reminders = [];

  if (pending > 0) {
    reminders.push(
        formatReminder(
          `doctor-pending-${pending}`,
          'Hồ sơ của bạn đang chờ duyệt',
          `Bạn hiện có ${pending} hồ sơ CME đang chờ xử lý.`,
          '/records',
          NOTIFICATION_TYPES.RECORD_SUBMITTED,
          NOTIFICATION_PRIORITIES.HIGH
        )
      );
    }

  const remaining = Math.max(0, 24 - totalPoints);
  if (remaining > 0) {
    reminders.push(
        formatReminder(
          `doctor-remaining-${remaining}`,
          'Bạn còn thiếu điểm CME',
          `Bạn còn thiếu ${remaining} điểm CME để đạt chuẩn năm nay.`,
          '/records',
          NOTIFICATION_TYPES.REMINDER,
          NOTIFICATION_PRIORITIES.MEDIUM
        )
      );
    }

  if (suggestedCourses.length > 0) {
    reminders.push(
        formatReminder(
          `doctor-courses-${suggestedCourses.length}`,
          'Có khóa học gợi ý cho bạn',
          `Hiện có ${suggestedCourses.length} khóa học phù hợp với khoa/phòng của bạn.`,
          '/my-courses',
          NOTIFICATION_TYPES.COURSE_CREATED
        )
    );
  }

  const today = new Date();
  if (today.getDay() === 1) {
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    currentWeekStart.setHours(0, 0, 0, 0);
    const weeklyPoints = await CMERecord.aggregate([
      {
        $match: {
          userId: user._id,
          status: 'admin_approved',
          deletedAt: null,
          createdAt: { $gte: currentWeekStart },
        },
      },
      { $group: { _id: null, totalPoints: { $sum: '$points' } } },
    ]);

    reminders.push(
      formatReminder(
        `doctor-weekly-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`,
        'Tổng kết điểm hàng tuần',
        `Tuần qua bạn đã được cộng ${weeklyPoints[0]?.totalPoints || 0} điểm. Tiến độ năm hiện tại là ${totalPoints}/24.`,
        '/records',
        NOTIFICATION_TYPES.WEEKLY_SUMMARY,
        NOTIFICATION_PRIORITIES.LOW
      )
    );
  }

  const deadlineCourses = await Course.find({
    deletedAt: null,
    applicableDepartments: user.departmentId,
    submissionStatus: { $in: ['OPEN', 'SUBMISSION_OPEN'] },
    endDate: { $gt: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  })
    .select('_id title endDate')
    .limit(5);

  deadlineCourses.forEach((course) => {
    const dayLeft = Math.max(1, Math.ceil((new Date(course.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    reminders.push(
      formatReminder(
        `doctor-deadline-${course._id}`,
        'Nhắc nhở deadline khóa học',
        `Khóa học "${course.title}" còn ${dayLeft} ngày trước khi hết hạn.`,
        '/my-courses',
        NOTIFICATION_TYPES.COURSE_DEADLINE,
        dayLeft <= 1 ? NOTIFICATION_PRIORITIES.CRITICAL : dayLeft <= 3 ? NOTIFICATION_PRIORITIES.HIGH : NOTIFICATION_PRIORITIES.MEDIUM
      )
    );
  });

  return reminders;
};

const listNotifications = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const rawPageSize = parseInt(req.query.pageSize, 10);
  const pageSize = [10, 20, 50].includes(rawPageSize) ? rawPageSize : 10;
  const read = req.query.read;
  const q = String(req.query.q || '').trim();
  const type = String(req.query.type || 'all');
  const category = String(req.query.category || 'all');
  const priority = String(req.query.priority || 'all');
  const audienceType = String(req.query.audienceType || 'all');
  const role = String(req.query.role || 'all');

  const filter = { recipientUserId: req.user._id };
  if (read === 'read') filter.isRead = true;
  if (read === 'unread') filter.isRead = false;
  if (type !== 'all') filter.type = type;
  if (category !== 'all') filter.category = category;
  if (priority !== 'all') filter.priority = priority;
  if (audienceType !== 'all') filter.audienceType = audienceType;
  if (role !== 'all') filter.recipientRole = role;
  if (q) {
    const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: safeQuery, $options: 'i' } },
      { message: { $regex: safeQuery, $options: 'i' } },
    ];
  }

  const reminderFilters = { q, type, category, priority, audienceType, role };

  const [total, unreadCount, notifications, reminders, priorityStats] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientUserId: req.user._id, isRead: false }),
    Notification.find(filter)
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    getReminders(req.user),
    Notification.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$priority',
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  const filteredReminders = reminders.filter((item) => matchesReminderFilters(item, reminderFilters));
  const reminderCount = filteredReminders.length;
  const combinedUnreadCount = unreadCount + reminderCount;
  const reminderPriorityStats = filteredReminders.reduce(
    (acc, item) => {
      acc[priorityBucket(item.priority)] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );
  const notificationPriorityStats = priorityStats.reduce(
    (acc, item) => {
      acc[priorityBucket(item._id)] += item.total || 0;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  return res.json({
    reminders: filteredReminders,
    notifications: notifications.map((notification) => ({
      ...notification,
      virtual: false,
    })),
    unreadCount: combinedUnreadCount,
    reminderCount,
    summary: {
      critical: reminderPriorityStats.critical + notificationPriorityStats.critical,
      warning: reminderPriorityStats.warning + notificationPriorityStats.warning,
      info: reminderPriorityStats.info + notificationPriorityStats.info,
      total: reminderCount + total,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
};

const unreadCount = async (req, res) => {
  const [unreadDb, reminders] = await Promise.all([
    Notification.countDocuments({ recipientUserId: req.user._id, isRead: false }),
    getReminders(req.user),
  ]);

  return res.json({ unreadCount: unreadDb + reminders.length });
};

const deleteReadNotifications = async (req, res) => {
  const result = await Notification.deleteMany({
    recipientUserId: req.user._id,
    isRead: true,
  });

  return res.json({
    message: 'Đã xóa các thông báo đã đọc.',
    deletedCount: result.deletedCount || 0,
  });
};

const markAsRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientUserId: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
  }

  return res.json(notification);
};

const markAllAsRead = async (req, res) => {
  await Notification.updateMany(
    { recipientUserId: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return res.json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc.' });
};

const broadcastNotification = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const {
    title,
    message,
    link = '',
    type = NOTIFICATION_TYPES.SYSTEM,
    priority = NOTIFICATION_PRIORITIES.MEDIUM,
    category = NOTIFICATION_CATEGORIES.SYSTEM,
    audienceType = NOTIFICATION_AUDIENCE_TYPES.GLOBAL,
    targetRoles = [],
    targetUsers = [],
    targetDepartments = [],
    meta = {},
    groupKey = '',
    deliveryChannels = ['in_app'],
  } = req.body || {};

  if (!title || !message) {
    return res.status(400).json({ message: 'Thiếu tiêu đề hoặc nội dung thông báo.' });
  }

  const sent = await notifyAudience(
    {
      type: audienceType,
      targetRoles,
      targetUsers,
      targetDepartments,
    },
    {
      title,
      message,
      link,
      type,
      priority,
      category,
      meta,
      createdBy: req.user._id,
      groupKey,
      deliveryChannels,
    }
  );

  return res.status(201).json({
    message: 'Đã gửi thông báo.',
    sentCount: sent?.length || 0,
  });
};

module.exports = {
  listNotifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
  deleteReadNotifications,
  broadcastNotification,
};
