const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { writeAudit } = require('../services/auditService');

const listUsers = async (_req, res) => {
  const users = await User.find({ deletedAt: null })
    .select('-password')
    .populate('departmentId', 'name')
    .sort({ createdAt: -1 });
  return res.json(users);
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
  const { id } = req.params;
  const patch = { ...req.body };
  if (patch.username) patch.username = String(patch.username).toLowerCase();
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

module.exports = { listUsers, createUser, updateUser, resetPassword, deleteUser };
