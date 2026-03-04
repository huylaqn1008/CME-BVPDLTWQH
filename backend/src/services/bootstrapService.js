const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ensureAdminAccount = async () => {
  const existingAdmin = await User.findOne({ role: 'ADMIN', deletedAt: null });
  if (existingAdmin) return;

  const username = 'admin';
  const password = await bcrypt.hash('Admin@123', 10);

  await User.create({
    name: 'Quản trị hệ thống',
    username,
    password,
    role: 'ADMIN',
    isActive: true,
  });

  console.log('[bootstrap] Created default admin account: admin / Admin@123');
};

module.exports = { ensureAdminAccount };
