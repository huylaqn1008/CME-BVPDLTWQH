const { validationResult } = require('express-validator');
const Course = require('../models/Course');
const { writeAudit } = require('../services/auditService');

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

const deriveTimelineStatus = (course) => {
  const now = new Date();
  const start = course.startDate ? new Date(course.startDate) : null;
  const end = course.endDate ? new Date(course.endDate) : null;

  if (start && now < start) return 'UPCOMING';
  if (end && now > end) return 'ENDED';
  return 'OPEN';
};

const timelineStatusLabel = {
  OPEN: 'Đang mở',
  UPCOMING: 'Sắp mở',
  ENDED: 'Đã kết thúc',
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

  const course = await Course.create(payload);
  await writeAudit({ actorId: req.user._id, action: 'CREATE_COURSE', entityType: 'Course', entityId: course._id.toString() });
  return res.status(201).json(course);
};

const updateCourse = async (req, res) => {
  const payload = { ...req.body };
  if (Array.isArray(payload.applicableDepartments)) payload.applicableDepartments = [...new Set(payload.applicableDepartments)];

  const course = await Course.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!course) return res.status(404).json({ message: 'Course not found' });
  await writeAudit({ actorId: req.user._id, action: 'UPDATE_COURSE', entityType: 'Course', entityId: course._id.toString() });
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
    $or: [{ submissionStatus: { $exists: false } }, { submissionStatus: { $in: ['OPEN', 'SUBMISSION_OPEN'] } }],
    ...buildDoctorScopeFilter(req.user),
  };

  const courses = await Course.find(query)
    .select('title cmePoints submissionStatus applicableDepartments')
    .populate('applicableDepartments', 'name')
    .sort({ createdAt: -1 });

  return res.json(courses);
};

module.exports = { listCourses, createCourse, updateCourse, deleteCourse, listEligibleCoursesForDoctor };
