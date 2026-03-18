const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password } = req.body;
  const rawLogin = String(username || '').trim().toLowerCase();
  const usernameCandidate = rawLogin.includes('@') ? rawLogin.split('@')[0] : rawLogin;

  const user = await User.findOne({
    deletedAt: null,
    $or: [{ username: rawLogin }, { username: usernameCandidate }, { email: rawLogin }],
  });
  if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken({ id: user._id, role: user.role });
  const safeUser = user.toObject();
  delete safeUser.password;
  return res.json({ token, user: safeUser });
};

const me = async (req, res) => {
  const currentUser = await User.findById(req.user._id).populate('departmentId', 'name');
  if (!currentUser || currentUser.deletedAt) return res.status(404).json({ message: 'User not found' });

  const safeUser = currentUser.toObject();
  delete safeUser.password;
  return res.json(safeUser);
};

const updateMe = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const patch = {};
  ['name', 'birthDate', 'cccd', 'phone', 'email'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      patch[field] = req.body[field];
    }
  });

  if (typeof patch.name === 'string') patch.name = patch.name.trim();
  if (typeof patch.cccd === 'string') patch.cccd = patch.cccd.trim();
  if (typeof patch.phone === 'string') patch.phone = patch.phone.trim();
  if (typeof patch.email === 'string') patch.email = patch.email.trim().toLowerCase();
  if (patch.birthDate === '') patch.birthDate = null;

  const user = await User.findByIdAndUpdate(req.user._id, patch, { new: true }).populate('departmentId', 'name');
  if (!user || user.deletedAt) return res.status(404).json({ message: 'User not found' });

  const safeUser = user.toObject();
  delete safeUser.password;
  return res.json(safeUser);
};

module.exports = { login, me, updateMe };
