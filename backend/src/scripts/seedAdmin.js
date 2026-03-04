const bcrypt = require('bcryptjs');
const connectDb = require('../config/db');
const User = require('../models/User');

const run = async () => {
  await connectDb();

  const username = 'admin';
  const exists = await User.findOne({ username, deletedAt: null });
  if (exists) {
    console.log('Admin already exists:', username);
    process.exit(0);
  }

  const password = await bcrypt.hash('Admin@123', 10);
  await User.create({
    name: 'Quản trị hệ thống',
    username,
    password,
    role: 'ADMIN',
    isActive: true,
  });

  console.log('Seeded admin account');
  console.log('username: admin');
  console.log('password: Admin@123');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
