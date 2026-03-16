const User = require('../models/User');
const Course = require('../models/Course');
const CMERecord = require('../models/CMERecord');

const normalizeDate = (value, endOfDay = false) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
};

const getActivities = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    q = '',
    startDate,
    endDate,
    sort = 'desc',
  } = req.query;

  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate, true);
  const needle = q.toLowerCase();

  const [records, courses, users] = await Promise.all([
    CMERecord.find({ deletedAt: null })
      .populate('userId', 'name role')
      .select('title status points createdAt updatedAt userId'),
    Course.find({ deletedAt: null })
      .populate('createdBy', 'name role')
      .select('title createdAt updatedAt createdBy'),
    User.find({ deletedAt: null }).select('name role createdAt'),
  ]);

  const events = [];

  records.forEach((r) => {
    if (!r.userId) return;
    events.push({
      type: 'record_submit',
      action: 'Nộp hồ sơ CME',
      actor: r.userId.name,
      role: r.userId.role,
      target: r.title,
      points: r.points,
      createdAt: r.createdAt,
    });

    if (r.status === 'manager_approved') {
      events.push({
        type: 'record_manager_approved',
        action: 'Quản lý duyệt hồ sơ',
        actor: 'Quản lý khoa/phòng',
        role: 'MANAGER',
        target: r.title,
        points: r.points,
        createdAt: r.updatedAt,
      });
    }

    if (r.status === 'admin_approved') {
      events.push({
        type: 'record_admin_approved',
        action: 'Admin duyệt hồ sơ',
        actor: 'Admin',
        role: 'ADMIN',
        target: r.title,
        points: r.points,
        createdAt: r.updatedAt,
      });
    }
  });

  courses.forEach((c) => {
    events.push({
      type: 'course_created',
      action: 'Tạo khóa học',
      actor: c.createdBy?.name || 'Hệ thống',
      role: c.createdBy?.role || 'ADMIN',
      target: c.title,
      createdAt: c.createdAt,
    });

    if (Math.abs(c.updatedAt - c.createdAt) > 60 * 1000) {
      events.push({
        type: 'course_updated',
        action: 'Cập nhật khóa học',
        actor: c.createdBy?.name || 'Hệ thống',
        role: c.createdBy?.role || 'ADMIN',
        target: c.title,
        createdAt: c.updatedAt,
      });
    }
  });

  users.forEach((u) => {
    events.push({
      type: 'user_created',
      action: 'Tạo người dùng',
      actor: 'Admin',
      role: 'ADMIN',
      target: u.name,
      createdAt: u.createdAt,
    });
  });

  let filtered = events.filter((e) => {
    if (start && e.createdAt < start) return false;
    if (end && e.createdAt > end) return false;
    if (needle) {
      const hay = `${e.action} ${e.actor} ${e.target}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => (sort === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));

  const total = filtered.length;
  const pageNum = Number(page) || 1;
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));
  const startIdx = (pageNum - 1) * limitNum;
  const data = filtered.slice(startIdx, startIdx + limitNum);

  return res.json({ total, page: pageNum, limit: limitNum, data });
};

module.exports = { getActivities };
