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

const listCourses = async (req, res) => {
  const query = { deletedAt: null };
  if (req.user.role === 'DOCTOR') Object.assign(query, buildDoctorScopeFilter(req.user));

  const courses = await Course.find(query)
    .populate('createdBy', 'name username')
    .populate('applicableDepartments', 'name')
    .sort({ createdAt: -1 });

  return res.json(courses);
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
