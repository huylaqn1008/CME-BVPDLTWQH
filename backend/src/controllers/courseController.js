const { validationResult } = require('express-validator');
const User = require('../models/User');
const Course = require('../models/Course');
const { writeAudit } = require('../services/auditService');
const { NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES } = require('../constants/notifications');
const { notifyUsersByIds } = require('../services/notificationService');
const { deriveTimelineStatus, timelineStatusLabel } = require('../utils/courseStatus');

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

const normalizeSort = (sortBy, sortOrder) => {
  const allowed = ['title', 'startDate', 'createdAt'];
  const by = allowed.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder === 'asc' ? 1 : -1;
  return { [by]: order };
};

const getCourseRecipientsByRole = async (course) => {
  const departments = Array.isArray(course.applicableDepartments) ? course.applicableDepartments.filter(Boolean) : [];

  if (!departments.length) {
    const [admins, staff] = await Promise.all([
      User.find({ deletedAt: null, role: 'ADMIN' }).select('_id'),
      User.find({ deletedAt: null, role: { $in: ['MANAGER', 'DOCTOR'] } }).select('_id'),
    ]);
    return {
      admins: admins.map((user) => user._id),
      staff: staff.map((user) => user._id),
    };
  }

  const [admins, scopedUsers] = await Promise.all([
    User.find({ deletedAt: null, role: 'ADMIN' }).select('_id'),
    User.find({
      deletedAt: null,
      role: { $in: ['MANAGER', 'DOCTOR'] },
      departmentId: { $in: departments },
    }).select('_id'),
  ]);

  return {
    admins: admins.map((user) => user._id),
    staff: scopedUsers.map((user) => user._id),
  };
};


const listCourses = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    year,
    status = 'all',
    department,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const query = { deletedAt: null };
  if (req.user.role === 'DOCTOR') Object.assign(query, buildDoctorScopeFilter(req.user));

  if (search) {
    query.title = { $regex: String(search).trim(), $options: 'i' };
  }

  if (department && department !== 'all') {
    query.applicableDepartments = department;
  }

  if (year) {
    const y = Number(year);
    if (!Number.isNaN(y)) {
      const from = new Date(`${y}-01-01T00:00:00.000Z`);
      const to = new Date(`${y}-12-31T23:59:59.999Z`);
      query.startDate = { $gte: from };
      query.endDate = { $lte: to };
    }
  }

  const rawCourses = await Course.find(query)
    .populate('createdBy', 'name username')
    .populate('applicableDepartments', 'name')
    .sort(normalizeSort(sortBy, sortOrder));

  let courses = rawCourses.map((doc) => {
    const obj = doc.toObject();
    const timelineStatus = deriveTimelineStatus(obj);
    return {
      ...obj,
      timelineStatus,
      timelineStatusLabel: timelineStatusLabel[timelineStatus],
    };
  });

  if (status && status !== 'all') {
    courses = courses.filter((course) => course.timelineStatus === status);
  }

  const total = courses.length;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 10);
  const totalPages = Math.max(1, Math.ceil(total / limitNum));
  const currentPage = Math.min(pageNum, totalPages);
  const startIdx = (currentPage - 1) * limitNum;
  const data = courses.slice(startIdx, startIdx + limitNum);

  return res.json({
    data,
    pagination: {
      page: currentPage,
      limit: limitNum,
      total,
      totalPages,
    },
  });
};

const createCourse = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const payload = {
    ...req.body,
    createdBy: req.user._id,
    applicableDepartments: Array.isArray(req.body.applicableDepartments) ? [...new Set(req.body.applicableDepartments)] : [],
  };
  delete payload.submissionStatus;

  const course = await Course.create(payload);
  await writeAudit({ actorId: req.user._id, action: 'CREATE_COURSE', entityType: 'Course', entityId: course._id.toString() });
  const recipients = await getCourseRecipientsByRole(course);
  await Promise.all([
    notifyUsersByIds(recipients.admins, {
      title: 'Khóa học mới đã được tạo',
      message: `Khóa học "${course.title}" đã sẵn sàng trong hệ thống.`,
      type: NOTIFICATION_TYPES.COURSE_CREATED,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      link: '/courses',
      createdBy: req.user._id,
      meta: { courseId: course._id.toString() },
      audienceType: 'ROLE',
      targetRoles: ['ADMIN'],
      targetDepartments: course.applicableDepartments || [],
      category: 'learning',
      groupKey: `course-created-admin-${course._id.toString()}`,
    }),
    notifyUsersByIds(recipients.staff, {
      title: 'Khóa học mới dành cho bạn',
      message: `Khóa học "${course.title}" đã được thêm vào khu vực của bạn.`,
      type: NOTIFICATION_TYPES.COURSE_CREATED,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      link: '/my-courses',
      createdBy: req.user._id,
      meta: { courseId: course._id.toString() },
      audienceType: 'ROLE',
      targetRoles: ['MANAGER', 'DOCTOR'],
      targetDepartments: course.applicableDepartments || [],
      category: 'learning',
      groupKey: `course-created-staff-${course._id.toString()}`,
    }),
  ]);
  return res.status(201).json(course);
};

const updateCourse = async (req, res) => {
  const payload = { ...req.body };
  if (Array.isArray(payload.applicableDepartments)) payload.applicableDepartments = [...new Set(payload.applicableDepartments)];
  delete payload.submissionStatus;

  const course = await Course.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!course) return res.status(404).json({ message: 'Course not found' });
  await writeAudit({ actorId: req.user._id, action: 'UPDATE_COURSE', entityType: 'Course', entityId: course._id.toString() });
  const recipients = await getCourseRecipientsByRole(course);
  await Promise.all([
    notifyUsersByIds(recipients.admins, {
      title: 'Khóa học đã được cập nhật',
      message: `Khóa học "${course.title}" vừa có thay đổi mới.`,
      type: NOTIFICATION_TYPES.COURSE_UPDATED,
      priority: NOTIFICATION_PRIORITIES.LOW,
      link: '/courses',
      createdBy: req.user._id,
      meta: { courseId: course._id.toString() },
      audienceType: 'ROLE',
      targetRoles: ['ADMIN'],
      targetDepartments: course.applicableDepartments || [],
      category: 'learning',
      groupKey: `course-updated-admin-${course._id.toString()}`,
    }),
    notifyUsersByIds(recipients.staff, {
      title: 'Khóa học của bạn vừa thay đổi',
      message: `Khóa học "${course.title}" có cập nhật mới cho khu vực của bạn.`,
      type: NOTIFICATION_TYPES.COURSE_UPDATED,
      priority: NOTIFICATION_PRIORITIES.LOW,
      link: '/my-courses',
      createdBy: req.user._id,
      meta: { courseId: course._id.toString() },
      audienceType: 'ROLE',
      targetRoles: ['MANAGER', 'DOCTOR'],
      targetDepartments: course.applicableDepartments || [],
      category: 'learning',
      groupKey: `course-updated-staff-${course._id.toString()}`,
    }),
  ]);
  return res.json(course);
};

const deleteCourse = async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { deletedAt: new Date() }, { new: true });
  if (!course) return res.status(404).json({ message: 'Course not found' });
  await writeAudit({ actorId: req.user._id, action: 'DELETE_COURSE', entityType: 'Course', entityId: course._id.toString() });
  return res.json({ message: 'Course deleted' });
};

const listEligibleCoursesForDoctor = async (req, res) => {
  const query = {
    deletedAt: null,
    ...buildDoctorScopeFilter(req.user),
  };

  const courses = await Course.find(query)
    .select('title cmePoints applicableDepartments startDate endDate')
    .populate('applicableDepartments', 'name')
    .sort({ createdAt: -1 });

  const eligibleCourses = courses
    .map((doc) => {
      const obj = doc.toObject();
      const timelineStatus = deriveTimelineStatus(obj);
      return { ...obj, timelineStatus, timelineStatusLabel: timelineStatusLabel[timelineStatus] };
    })
    .filter((course) => course.timelineStatus === 'OPEN');

  return res.json(eligibleCourses);
};

const listMyCourses = async (req, res) => {
  if (!['MANAGER', 'DOCTOR'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const {
    page = 1,
    limit = 8,
    status = 'all',
    search,
  } = req.query;

  const query = { deletedAt: null };
  if (req.user.role === 'DOCTOR') Object.assign(query, buildDoctorScopeFilter(req.user));
  if (req.user.role === 'MANAGER') {
    query.$or = [
      { applicableDepartments: { $exists: false } },
      { applicableDepartments: { $size: 0 } },
      { applicableDepartments: req.user.departmentId },
    ];
  }
  if (search) {
    query.title = { $regex: String(search).trim(), $options: 'i' };
  }

  const courses = await Course.find(query)
    .select('title description cmePoints applicableDepartments submissionStatus startDate endDate attachments')
    .populate('applicableDepartments', 'name')
    .sort({ startDate: 1, createdAt: -1 });

  const result = courses.map((doc) => {
    const obj = doc.toObject();
    const timelineStatus = deriveTimelineStatus(obj);
    return {
      ...obj,
      timelineStatus,
      timelineStatusLabel: timelineStatusLabel[timelineStatus],
    };
  });

  const filtered = status && status !== 'all'
    ? result.filter((course) => course.timelineStatus === status)
    : result;

  const summary = filtered.reduce((acc, course) => {
    acc.total += 1;
    if (course.timelineStatus === 'OPEN') acc.open += 1;
    if (course.timelineStatus === 'UPCOMING') acc.upcoming += 1;
    if (course.timelineStatus === 'ENDED') acc.ended += 1;
    return acc;
  }, { total: 0, open: 0, upcoming: 0, ended: 0 });

  const total = filtered.length;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 8);
  const totalPages = Math.max(1, Math.ceil(total / limitNum));
  const currentPage = Math.min(pageNum, totalPages);
  const startIdx = (currentPage - 1) * limitNum;
  const data = filtered.slice(startIdx, startIdx + limitNum);

  return res.json({
    data,
    summary,
    pagination: {
      page: currentPage,
      limit: limitNum,
      total,
      totalPages,
    },
  });
};

module.exports = { listCourses, createCourse, updateCourse, deleteCourse, listEligibleCoursesForDoctor, listMyCourses };

