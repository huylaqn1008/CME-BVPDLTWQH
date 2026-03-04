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
  const safeUser = req.user.toObject();
  delete safeUser.password;
  return res.json(safeUser);
};

module.exports = { login, me };
