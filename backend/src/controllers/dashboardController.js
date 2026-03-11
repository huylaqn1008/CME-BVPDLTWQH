const User = require('../models/User');
const CMERecord = require('../models/CMERecord');
const Course = require('../models/Course');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');

const getDashboard = async (req, res) => {
  if (req.user.role === 'ADMIN') {
    const year = new Date().getFullYear();
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const [
      totalStaff,
      approvedRecords,
      lowPointUsers,
      openCourses,
      departmentStats,
      recentActivities,
      pendingRecordsCount,
    ] = await Promise.all([
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
      Course.countDocuments({ submissionStatus: { $in: ['OPEN', 'SUBMISSION_OPEN'] }, deletedAt: null }),
      CMERecord.aggregate([
        {
          $match: {
            status: 'admin_approved',
            deletedAt: null,
            createdAt: { $gte: start, $lt: end },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $lookup: {
            from: 'departments',
            localField: 'user.departmentId',
            foreignField: '_id',
            as: 'department',
          },
        },
        { $unwind: '$department' },
        {
          $group: {
            _id: '$department._id',
            name: { $first: '$department.name' },
            total: { $sum: '$points' },
          },
        },
        { $sort: { total: -1 } },
      ]),
      AuditLog.find({})
        .populate('actorId', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      CMERecord.countDocuments({ status: 'pending', deletedAt: null }),
    ]);

    const totalPointsYear = approvedRecords[0]?.total || 0;
    const missingCount = lowPointUsers[0]?.count || 0;

    return res.json({
      role: 'ADMIN',
      totalStaff,
      totalPointsYear,
      reachedStandardPercent: totalStaff ? Math.round(((totalStaff - missingCount) / totalStaff) * 100) : 0,
      missingCount,
      openCourses,
      departmentStats,
      recentActivities: recentActivities.map((log) => ({
        name: log.actorId?.name || 'Unknown',
        action: log.action,
        time: log.createdAt,
      })),
      pendingTasks: [
        { label: 'Hồ sơ CME chờ duyệt', value: pendingRecordsCount, type: 'records' },
        { label: 'Bác sĩ thiếu điểm', value: missingCount, type: 'doctors' },
      ],
    });
  }

  if (req.user.role === 'MANAGER') {
    const users = await User.find({ departmentId: req.user.departmentId, role: 'DOCTOR', deletedAt: null });
    const ids = users.map((u) => u._id);

    const [approved, pending, doctorPoints, doctorsNeedingAttention] = await Promise.all([
      CMERecord.aggregate([
        { $match: { userId: { $in: ids }, status: 'admin_approved', deletedAt: null } },
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
      ]),
      CMERecord.countDocuments({ userId: { $in: ids }, status: 'pending', deletedAt: null }),
      CMERecord.aggregate([
        { $match: { userId: { $in: ids }, status: 'admin_approved', deletedAt: null } },
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            name: '$user.name',
            total: 1,
          },
        },
        { $sort: { total: -1 } },
      ]),
      CMERecord.aggregate([
        { $match: { userId: { $in: ids }, status: 'admin_approved', deletedAt: null } },
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
        { $match: { total: { $lt: 24 } } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            name: '$user.name',
            total: 1,
          },
        },
        { $sort: { total: 1 } },
        { $limit: 10 },
      ]),
    ]);

    const lacking = Math.max(0, users.length - approved.filter((a) => a.total >= 24).length);
    return res.json({
      role: 'MANAGER',
      totalStaffInDepartment: users.length,
      lacking,
      pendingRecords: pending,
      doctorPoints,
      doctorsNeedingAttention,
    });
  }

  const [approvedRecords, pending, suggestedCourses, recentRecords] = await Promise.all([
    CMERecord.find({ userId: req.user._id, status: 'admin_approved', deletedAt: null }),
    CMERecord.countDocuments({ userId: req.user._id, status: 'pending', deletedAt: null }),
    Course.find({
      applicableDepartments: req.user.departmentId,
      submissionStatus: { $in: ['OPEN', 'SUBMISSION_OPEN'] },
      endDate: { $gt: new Date() }, // Only courses that haven't ended yet
      deletedAt: null,
    }).limit(5),
    CMERecord.find({ userId: req.user._id, status: 'admin_approved', deletedAt: null })
      .populate('courseId', 'title cmePoints')
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const totalPoints = approvedRecords.reduce((sum, r) => sum + r.points, 0);
  return res.json({
    role: 'DOCTOR',
    totalPoints,
    pointsRemaining: Math.max(0, 24 - totalPoints),
    pending,
    suggestedCourses: suggestedCourses.map((c) => ({ 
      id: c._id, 
      title: c.title, 
      points: c.cmePoints,
      endDate: c.endDate 
    })),
    recentRecords: recentRecords.map((r) => ({
      title: r.courseId?.title || 'Unknown',
      points: r.points,
      date: r.createdAt,
    })),
  });
};

module.exports = { getDashboard };

