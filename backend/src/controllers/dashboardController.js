const User = require('../models/User');
const CMERecord = require('../models/CMERecord');

const getDashboard = async (req, res) => {
  if (req.user.role === 'ADMIN') {
    const year = new Date().getFullYear();
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const [totalStaff, approvedRecords, lowPointUsers] = await Promise.all([
      User.countDocuments({ role: 'DOCTOR', deletedAt: null }),
      CMERecord.aggregate([
        { $match: { status: 'admin_approved', deletedAt: null, createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
      CMERecord.aggregate([
        { $match: { status: 'admin_approved', deletedAt: null } },
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
        { $match: { total: { $lt: 24 } } },
        { $count: 'count' },
      ]),
    ]);

    const totalPointsYear = approvedRecords[0]?.total || 0;
    const missingCount = lowPointUsers[0]?.count || 0;

    return res.json({
      role: 'ADMIN',
      totalStaff,
      totalPointsYear,
      reachedStandardPercent: totalStaff ? Math.round(((totalStaff - missingCount) / totalStaff) * 100) : 0,
      missingCount,
    });
  }

  if (req.user.role === 'MANAGER') {
    const users = await User.find({ departmentId: req.user.departmentId, role: 'DOCTOR', deletedAt: null });
    const ids = users.map((u) => u._id);

    const [approved, pending] = await Promise.all([
      CMERecord.aggregate([
        { $match: { userId: { $in: ids }, status: 'admin_approved', deletedAt: null } },
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
      ]),
      CMERecord.countDocuments({ userId: { $in: ids }, status: 'pending', deletedAt: null }),
    ]);

    const lacking = Math.max(0, users.length - approved.filter((a) => a.total >= 24).length);
    return res.json({ role: 'MANAGER', totalStaffInDepartment: users.length, lacking, pendingRecords: pending });
  }

  const [approvedRecords, pending] = await Promise.all([
    CMERecord.find({ userId: req.user._id, status: 'admin_approved', deletedAt: null }),
    CMERecord.countDocuments({ userId: req.user._id, status: 'pending', deletedAt: null }),
  ]);

  const totalPoints = approvedRecords.reduce((sum, r) => sum + r.points, 0);
  return res.json({ role: 'DOCTOR', totalPoints, pointsRemaining: Math.max(0, 24 - totalPoints), pending });
};

module.exports = { getDashboard };

