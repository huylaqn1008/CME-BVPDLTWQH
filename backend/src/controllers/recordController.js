const path = require('path');
const { validationResult } = require('express-validator');
const CMERecord = require('../models/CMERecord');
const User = require('../models/User');
const Course = require('../models/Course');
const ApprovalHistory = require('../models/ApprovalHistory');
const Certificate = require('../models/Certificate');
const { generateCertificate } = require('../utils/certificate');
const { writeAudit } = require('../services/auditService');
const { deriveTimelineStatus } = require('../utils/courseStatus');

const courseVisibleForDoctor = (course, doctor) => {
  const departments = Array.isArray(course.applicableDepartments) ? course.applicableDepartments : [];
  if (departments.length === 0) return true;
  if (!doctor?.departmentId) return false;
  return departments.some((id) => id.toString() === doctor.departmentId.toString());
};

const listRecords = async (req, res) => {
  const query = { deletedAt: null };
  if (req.user.role === 'DOCTOR') query.userId = req.user._id;
  if (req.user.role === 'MANAGER') {
    const staffInDept = await User.find({
      departmentId: req.user.departmentId,
      role: 'DOCTOR',
      deletedAt: null,
    }).select('_id');
    query.userId = { $in: staffInDept.map((x) => x._id) };
  }

  const records = await CMERecord.find(query)
    .populate('userId', 'name username departmentId')
    .populate('courseId', 'title')
    .sort({ createdAt: -1 });

  return res.json(records);
};

const listApprovalQueue = async (req, res) => {
  const query = { deletedAt: null, type: 'external' };

  if (req.user.role === 'MANAGER') {
    const doctorIds = await User.find({
      departmentId: req.user.departmentId,
      role: 'DOCTOR',
      deletedAt: null,
    }).select('_id');
    query.userId = { $in: doctorIds.map((x) => x._id) };
    query.status = 'pending';
  } else if (req.user.role === 'ADMIN') {
    query.status = 'manager_approved';
  } else {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const records = await CMERecord.find(query)
    .populate('userId', 'name username departmentId')
    .populate('courseId', 'title')
    .sort({ createdAt: -1 });

  return res.json(records);
};

const createExternalRecord = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (!req.file) return res.status(400).json({ message: 'Vui lòng tải lên file minh chứng' });

  const { courseId } = req.body;
  const course = await Course.findOne({ _id: courseId, deletedAt: null }).select('title cmePoints applicableDepartments startDate endDate');
  if (!course) return res.status(404).json({ message: 'Khóa học không tồn tại' });

  if (deriveTimelineStatus(course) !== 'OPEN') {
    return res.status(400).json({ message: 'Khóa học hiện không cho phép nộp minh chứng' });
  }

  if (!courseVisibleForDoctor(course, req.user)) {
    return res.status(403).json({ message: 'Bạn không thuộc khoa/phòng được phép nộp khóa học này' });
  }

  const record = await CMERecord.create({
    userId: req.user._id,
    courseId: course._id,
    title: course.title,
    type: 'external',
    points: course.cmePoints,
    status: 'pending',
    evidenceFile: req.file.filename,
  });

  await writeAudit({ actorId: req.user._id, action: 'UPLOAD_EXTERNAL_RECORD', entityType: 'CMERecord', entityId: record._id.toString() });
  return res.status(201).json(record);
};

const doctorResubmitRejectedRecord = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { courseId } = req.body;
  const record = await CMERecord.findById(req.params.id);
  if (!record || record.deletedAt) return res.status(404).json({ message: 'Record not found' });
  if (record.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
  if (record.status !== 'rejected') return res.status(400).json({ message: 'Chỉ hồ sơ bị từ chối mới được sửa gửi lại' });
  if (record.type !== 'external') return res.status(400).json({ message: 'Chỉ áp dụng cho hồ sơ ngoại viện' });

  const course = await Course.findOne({ _id: courseId, deletedAt: null }).select('title cmePoints applicableDepartments startDate endDate');
  if (!course) return res.status(404).json({ message: 'Khóa học không tồn tại' });
  if (deriveTimelineStatus(course) !== 'OPEN') {
    return res.status(400).json({ message: 'Khóa học hiện không cho phép nộp minh chứng' });
  }
  if (!courseVisibleForDoctor(course, req.user)) {
    return res.status(403).json({ message: 'Bạn không thuộc khoa/phòng được phép nộp khóa học này' });
  }

  record.courseId = course._id;
  record.title = course.title;
  record.points = course.cmePoints;
  record.status = 'pending';
  record.note = '';
  if (req.file) record.evidenceFile = req.file.filename;
  await record.save();

  await writeAudit({
    actorId: req.user._id,
    action: 'RESUBMIT_REJECTED_RECORD',
    entityType: 'CMERecord',
    entityId: record._id.toString(),
  });

  return res.json(record);
};

const doctorDeleteRejectedRecord = async (req, res) => {
  const record = await CMERecord.findById(req.params.id);
  if (!record || record.deletedAt) return res.status(404).json({ message: 'Record not found' });
  if (record.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
  if (record.status !== 'rejected') return res.status(400).json({ message: 'Chỉ hồ sơ bị từ chối mới được xóa' });
  if (record.type !== 'external') return res.status(400).json({ message: 'Chỉ áp dụng cho hồ sơ ngoại viện' });

  record.deletedAt = new Date();
  await record.save();

  await writeAudit({
    actorId: req.user._id,
    action: 'DELETE_REJECTED_RECORD',
    entityType: 'CMERecord',
    entityId: record._id.toString(),
  });

  return res.json({ message: 'Đã xóa hồ sơ bị từ chối' });
};

const createInternalCompletion = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { userId, courseId } = req.body;
  const course = await Course.findOne({ _id: courseId, deletedAt: null });
  if (!course) return res.status(404).json({ message: 'Course not found' });

  const staff = await User.findOne({ _id: userId, deletedAt: null });
  if (!staff) return res.status(404).json({ message: 'User not found' });

  const record = await CMERecord.create({
    userId,
    courseId,
    title: course.title,
    type: 'internal',
    points: course.cmePoints,
    status: 'admin_approved',
  });

  await ApprovalHistory.create({
    cmeRecordId: record._id,
    approvedBy: req.user._id,
    role: 'ADMIN',
    status: 'admin_approved',
    note: 'Internal training completion confirmed by admin',
  });

  const certOutputDir = path.join(__dirname, '../../uploads/certificates');
  const cert = await generateCertificate({
    userName: staff.name,
    courseTitle: course.title,
    points: course.cmePoints,
    outputDir: certOutputDir,
  });

  await Certificate.create({
    userId,
    cmeRecordId: record._id,
    certificateNumber: cert.certificateNumber,
    fileUrl: cert.fileName,
  });

  record.certificateFile = cert.fileName;
  await record.save();

  await writeAudit({ actorId: req.user._id, action: 'CREATE_INTERNAL_RECORD', entityType: 'CMERecord', entityId: record._id.toString() });
  return res.status(201).json(record);
};

const managerReview = async (req, res) => {
  const { status, note } = req.body;
  const record = await CMERecord.findById(req.params.id).populate('userId', 'departmentId');
  if (!record || record.deletedAt) return res.status(404).json({ message: 'Record not found' });
  if (record.userId.departmentId?.toString() !== req.user.departmentId?.toString()) return res.status(403).json({ message: 'Not in your department' });
  if (record.status !== 'pending') return res.status(400).json({ message: 'Only pending records can be reviewed by manager' });

  record.status = status === 'approve' ? 'manager_approved' : 'rejected';
  record.note = note;
  await record.save();

  await ApprovalHistory.create({ cmeRecordId: record._id, approvedBy: req.user._id, role: 'MANAGER', status: record.status, note });
  return res.json(record);
};

const adminReview = async (req, res) => {
  const { status, note, approvedPoints } = req.body;
  const record = await CMERecord.findById(req.params.id).populate('userId', 'name');
  if (!record || record.deletedAt) return res.status(404).json({ message: 'Record not found' });
  if (record.status !== 'manager_approved') return res.status(400).json({ message: 'Record must be manager approved first' });

  if (status === 'reject') {
    record.status = 'rejected';
    record.note = note;
    await record.save();
  } else {
    record.status = 'admin_approved';
    record.points = Number(approvedPoints ?? record.points);
    record.note = note;

    const certOutputDir = path.join(__dirname, '../../uploads/certificates');
    const cert = await generateCertificate({
      userName: record.userId.name,
      courseTitle: record.title,
      points: record.points,
      outputDir: certOutputDir,
    });

    await Certificate.create({
      userId: record.userId._id,
      cmeRecordId: record._id,
      certificateNumber: cert.certificateNumber,
      fileUrl: cert.fileName,
    });

    record.certificateFile = cert.fileName;
    await record.save();
  }

  await ApprovalHistory.create({ cmeRecordId: record._id, approvedBy: req.user._id, role: 'ADMIN', status: record.status, note });
  await writeAudit({ actorId: req.user._id, action: 'ADMIN_REVIEW_RECORD', entityType: 'CMERecord', entityId: record._id.toString(), meta: { status: record.status } });

  return res.json(record);
};

const getCertificates = async (req, res) => {
  const query = {};
  if (req.user.role === 'DOCTOR') query.userId = req.user._id;

  const certs = await Certificate.find(query)
    .populate('userId', 'name username')
    .populate('cmeRecordId', 'title points type')
    .sort({ createdAt: -1 });

  return res.json(certs);
};

const getSummary = async (req, res) => {
  const match = { deletedAt: null, status: 'admin_approved' };

  if (req.user.role === 'DOCTOR') match.userId = req.user._id;
  else if (req.user.role === 'MANAGER') {
    const staffIds = await User.find({ departmentId: req.user.departmentId, deletedAt: null }).select('_id');
    match.userId = { $in: staffIds.map((x) => x._id) };
  }

  const [totalPoints] = await CMERecord.aggregate([{ $match: match }, { $group: { _id: null, points: { $sum: '$points' } } }]);

  const pendingFilter = { deletedAt: null };
  if (req.user.role === 'DOCTOR') pendingFilter.userId = req.user._id;
  if (req.user.role === 'MANAGER') {
    const staffIds = await User.find({ departmentId: req.user.departmentId, deletedAt: null }).select('_id');
    pendingFilter.userId = { $in: staffIds.map((x) => x._id) };
  }

  const [pending, managerApproved] = await Promise.all([
    CMERecord.countDocuments({ ...pendingFilter, status: 'pending' }),
    CMERecord.countDocuments({ ...pendingFilter, status: 'manager_approved' }),
  ]);

  return res.json({ totalPoints: totalPoints?.points || 0, pending, managerApproved });
};

const downloadEvidence = async (req, res) => {
  const record = await CMERecord.findById(req.params.id).populate('userId', 'departmentId');
  if (!record || !record.evidenceFile) return res.status(404).json({ message: 'File not found' });

  if (req.user.role === 'DOCTOR' && record.userId._id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
  if (req.user.role === 'MANAGER' && record.userId.departmentId?.toString() !== req.user.departmentId?.toString()) return res.status(403).json({ message: 'Forbidden' });

  const filePath = path.join(__dirname, '../../uploads/evidence', record.evidenceFile);
  return res.sendFile(filePath);
};

module.exports = {
  listRecords,
  listApprovalQueue,
  createExternalRecord,
  doctorResubmitRejectedRecord,
  doctorDeleteRejectedRecord,
  createInternalCompletion,
  managerReview,
  adminReview,
  getCertificates,
  getSummary,
  downloadEvidence,
};
