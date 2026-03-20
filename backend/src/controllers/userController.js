const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const CMERecord = require('../models/CMERecord');
const { writeAudit } = require('../services/auditService');

const listUsers = async (_req, res) => {
  const users = await User.find({ deletedAt: null })
    .select('-password')
    .populate('departmentId', 'name')
    .sort({ createdAt: -1 });
  return res.json(users);
};

const listDepartmentDoctors = async (req, res) => {
  if (!req.user.departmentId) {
    return res.status(400).json({ message: 'Bạn chưa được gán khoa/phòng.' });
  }

  const [departmentDoctors, department] = await Promise.all([
    User.find({
      deletedAt: null,
      role: 'DOCTOR',
      departmentId: req.user.departmentId,
    })
      .select('-password')
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 }),
    User.findById(req.user._id).populate('departmentId', 'name'),
  ]);

  const activeDoctors = departmentDoctors.filter((doctor) => doctor.isActive).length;
  return res.json({
    departmentName: department?.departmentId?.name || '',
    totalDoctors: departmentDoctors.length,
    activeDoctors,
    doctors: departmentDoctors,
  });
};

const getDepartmentDoctorDetail = async (req, res) => {
  if (!req.user.departmentId) {
    return res.status(400).json({ message: 'Bạn chưa được gán khoa/phòng.' });
  }

  const doctor = await User.findOne({
    _id: req.params.id,
    role: 'DOCTOR',
    deletedAt: null,
    departmentId: req.user.departmentId,
  })
    .select('-password')
    .populate('departmentId', 'name');

  if (!doctor) {
    return res.status(404).json({ message: 'Không tìm thấy bác sĩ trong khoa của bạn.' });
  }

  const records = await CMERecord.find({
    userId: doctor._id,
    deletedAt: null,
  })
    .populate('courseId', 'title cmePoints')
    .sort({ createdAt: -1 });

  const summary = records.reduce(
    (acc, record) => {
      acc.totalPoints += Number(record.points || 0);
      acc.totalRecords += 1;
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    },
    { totalPoints: 0, totalRecords: 0, pending: 0, manager_approved: 0, admin_approved: 0, rejected: 0 }
  );

  return res.json({
    doctor,
    summary,
    recentRecords: records.slice(0, 8),
  });
};

const createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, username, password, role, departmentId } = req.body;
  const exists = await User.findOne({ username: String(username).toLowerCase(), deletedAt: null });
  if (exists) return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    username: String(username).toLowerCase(),
    password: hashed,
    role,
    departmentId: departmentId || null,
  });

  await writeAudit({ actorId: req.user._id, action: 'CREATE_USER', entityType: 'User', entityId: user._id.toString() });
  const safeUser = user.toObject();
  delete safeUser.password;
  return res.status(201).json(safeUser);
};

const updateUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const patch = { ...req.body };
  if (patch.username) patch.username = String(patch.username).toLowerCase();
  if (patch.password) {
    patch.password = await bcrypt.hash(patch.password, 10);
  } else {
    delete patch.password;
  }
  const user = await User.findByIdAndUpdate(id, patch, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });

  await writeAudit({ actorId: req.user._id, action: 'UPDATE_USER', entityType: 'User', entityId: user._id.toString() });
  const safeUser = user.toObject();
  delete safeUser.password;
  return res.json(safeUser);
};

const resetPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const password = await bcrypt.hash(newPassword, 10);
  const user = await User.findByIdAndUpdate(id, { password }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });

  await writeAudit({ actorId: req.user._id, action: 'RESET_PASSWORD', entityType: 'User', entityId: user._id.toString() });
  return res.json({ message: 'Password reset successful' });
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const user = await User.findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });

  await writeAudit({ actorId: req.user._id, action: 'SOFT_DELETE_USER', entityType: 'User', entityId: user._id.toString() });
  return res.json({ message: 'User deleted' });
};

module.exports = {
  listUsers,
  listDepartmentDoctors,
  getDepartmentDoctorDetail,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
};
