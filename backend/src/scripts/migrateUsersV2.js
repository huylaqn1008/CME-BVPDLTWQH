const connectDb = require('../config/db');
const User = require('../models/User');

const sanitizeUsername = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 30);

const ensureUniqueUsername = async (base, currentId) => {
  let candidate = base || `user${Date.now()}`;
  let i = 0;
  while (true) {
    const exists = await User.findOne({
      _id: { $ne: currentId },
      username: candidate,
      deletedAt: null,
    });
    if (!exists) return candidate;
    i += 1;
    candidate = `${base}${i}`.slice(0, 30);
  }
};

const run = async () => {
  await connectDb();

  const users = await User.find({});
  let updated = 0;

  for (const user of users) {
    let changed = false;

    if (user.role === 'STAFF') {
      user.role = 'DOCTOR';
      changed = true;
    }

    if (!user.username) {
      const rawBase = sanitizeUsername(user.email?.split('@')[0] || user.name || 'user');
      user.username = await ensureUniqueUsername(rawBase, user._id);
      changed = true;
    }

    if (changed) {
      await user.save();
      updated += 1;
    }
  }

  console.log(`Migration done. Updated users: ${updated}`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
