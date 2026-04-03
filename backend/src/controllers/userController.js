const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const XLSX = require('xlsx');
const User = require('../models/User');
const Department = require('../models/Department');
const CMERecord = require('../models/CMERecord');
const { writeAudit } = require('../services/auditService');
const { NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES } = require('../constants/notifications');
const { notifyUsersByIds } = require('../services/notificationService');

const DEFAULT_IMPORT_PASSWORD = 'Meoken1@2@3';

const normalizeText = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeKey = (value = '') => normalizeText(value).replace(/[^a-z0-9]+/g, '');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeRole = (value = '') => {
  const key = normalizeKey(value);
  if (['admin', 'quantrihesothong', 'quantrihethong'].includes(key)) return 'ADMIN';
  if (['manager', 'quanlykhoaphong', 'quanlykhoa', 'quanly'].includes(key)) return 'MANAGER';
  if (['doctor', 'bacsi', 'bacsiphong', 'bacsikhoa'].includes(key)) return 'DOCTOR';
  if (['admin', 'manager', 'doctor'].includes(String(value).trim().toLowerCase())) {
    return String(value).trim().toUpperCase();
  }
  return '';
};

const pickValue = (row, candidates) => {
  const map = new Map(Object.entries(row || []).map(([key, val]) => [normalizeKey(key), val]));
  for (const candidate of candidates) {
    const value = map.get(normalizeKey(candidate));
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
};

const listUsers = async (_req, res) => {
  const page = Math.max(parseInt(_req.query.page, 10) || 1, 1);
  const rawPageSize = parseInt(_req.query.pageSize, 10);
  const pageSize = [10, 20, 50].includes(rawPageSize) ? rawPageSize : 10;
  const { q = '', role = '', departmentId = '', status = '' } = _req.query;

  const filter = { deletedAt: null };
  if (role && ['ADMIN', 'MANAGER', 'DOCTOR'].includes(role)) filter.role = role;
  if (departmentId) filter.departmentId = departmentId;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  if (q && String(q).trim()) {
    const safeQuery = escapeRegex(String(q).trim());
    filter.$or = [
      { name: { $regex: safeQuery, $options: 'i' } },
      { username: { $regex: safeQuery, $options: 'i' } },
    ];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('-password')
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
  ]);

  return _req.query.page || _req.query.pageSize || q || role || departmentId || status
    ? res.json({
        users,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      })
    : res.json(users);
};

const importUsers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Vui lòng chọn file Excel để import.' });
  }

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err) {
    return res.status(400).json({ message: 'File Excel không hợp lệ.' });
  }

  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    return res.status(400).json({ message: 'File Excel không có dữ liệu.' });
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (!rows.length) {
    return res.status(400).json({ message: 'File Excel không có dòng dữ liệu nào.' });
  }

  const [departments, existingUsers] = await Promise.all([
    Department.find({ deletedAt: null }).select('_id name').lean(),
    User.find({ deletedAt: null }).select('username').lean(),
  ]);

  const departmentMap = new Map(departments.map((department) => [normalizeText(department.name), department]));
  const usedUsernames = new Set(existingUsers.map((user) => String(user.username || '').toLowerCase()));
  const records = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const hasAnyValue = Object.values(row).some((value) => String(value ?? '').trim() !== '');
    if (!hasAnyValue) return;

    const name = pickValue(row, ['Họ và tên', 'Ho va ten', 'Họ tên', 'Ho ten', 'Tên', 'Name']);
    const username = pickValue(row, ['Tên tài khoản', 'Ten tai khoan', 'Tên đăng nhập', 'Ten dang nhap', 'Username']);
    const departmentName = pickValue(row, ['Khoa phòng', 'Khoa/Phòng', 'Khoa', 'Phong ban', 'Department']);
    const roleValue = pickValue(row, ['Vai trò', 'Vai tro', 'Role']);

    const rowErrors = [];
    if (!name) rowErrors.push('thiếu họ và tên');
    if (!username) rowErrors.push('thiếu tên tài khoản');
    if (!departmentName) rowErrors.push('thiếu khoa/phòng');
    if (!roleValue) rowErrors.push('thiếu vai trò');

    const role = normalizeRole(roleValue);
    if (roleValue && !role) rowErrors.push('vai trò không hợp lệ');
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (username && !/^[a-zA-Z0-9._-]{3,30}$/.test(normalizedUsername)) {
      rowErrors.push('tên tài khoản không hợp lệ');
    }

    const department = departmentMap.get(normalizeText(departmentName));
    if (departmentName && !department) rowErrors.push(`không tìm thấy khoa/phòng "${departmentName}"`);
    if (normalizedUsername && usedUsernames.has(normalizedUsername)) {
      rowErrors.push('tên tài khoản đã tồn tại');
    }

    if (rowErrors.length) {
      errors.push({ row: rowNumber, message: rowErrors.join(', ') });
      return;
    }
    usedUsernames.add(normalizedUsername);

    records.push({
      name,
      username: normalizedUsername,
      role,
      departmentId: department._id,
    });
  });

  if (errors.length) {
    return res.status(400).json({
      message: 'File Excel có dữ liệu chưa hợp lệ.',
      errors,
    });
  }

  if (!records.length) {
    return res.status(400).json({ message: 'Không tìm thấy dòng dữ liệu hợp lệ để import.' });
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_IMPORT_PASSWORD, 10);
  const createdUsers = [];

  for (const record of records) {
    const user = await User.create({
      ...record,
      password: hashedPassword,
    });
    createdUsers.push(user);
  }

  await notifyUsersByIds(
    createdUsers.map((user) => user._id),
    {
      title: 'Tài khoản đã được tạo',
      message: `Tài khoản CME của bạn đã được khởi tạo. Mật khẩu mặc định là ${DEFAULT_IMPORT_PASSWORD}.`,
      type: NOTIFICATION_TYPES.ACCOUNT_CREATED,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      link: '/profile',
      createdBy: req.user._id,
      audienceType: 'USER',
      targetUsers: createdUsers.map((user) => user._id),
      category: 'system',
      groupKey: `import-account-user-${createdUsers.length}`,
    }
  );

  const managerRecipients = await User.find({
    deletedAt: null,
    role: 'MANAGER',
    departmentId: { $in: createdUsers.map((user) => user.departmentId).filter(Boolean) },
  }).select('_id departmentId');

  if (managerRecipients.length > 0) {
      await notifyUsersByIds(managerRecipients.map((manager) => manager._id), {
        title: 'Bác sĩ mới được thêm vào khoa',
        message: `Hệ thống vừa tạo ${createdUsers.length} tài khoản bác sĩ mới trong khoa của bạn.`,
        type: NOTIFICATION_TYPES.DOCTOR_ADDED,
        priority: NOTIFICATION_PRIORITIES.LOW,
        link: '/department-doctors',
        createdBy: req.user._id,
        audienceType: 'ROLE',
        targetRoles: ['MANAGER'],
        targetDepartments: [...new Set(createdUsers.map((user) => user.departmentId?.toString()).filter(Boolean))],
        category: 'admin',
        groupKey: `doctor-added-${createdUsers.length}`,
      });
  }

  await writeAudit({
    actorId: req.user._id,
    action: 'IMPORT_USERS',
    entityType: 'User',
    entityId: createdUsers.map((user) => user._id.toString()).join(','),
  });

  await notifyUsersByIds([req.user._id], {
    title: 'Bulk import tài khoản hoàn thành',
    message: `Đã tạo ${createdUsers.length} tài khoản từ file Excel.`,
    type: NOTIFICATION_TYPES.BULK_IMPORT_COMPLETED,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    link: '/users',
    createdBy: req.user._id,
    meta: { createdCount: createdUsers.length },
    audienceType: 'USER',
    targetUsers: [req.user._id],
    category: 'admin',
    groupKey: `bulk-import-${req.user._id.toString()}`,
  });

  return res.status(201).json({
    message: 'Import tài khoản thành công.',
    defaultPassword: DEFAULT_IMPORT_PASSWORD,
    createdCount: createdUsers.length,
    users: createdUsers.map((user) => ({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
    })),
  });
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

  await notifyUsersByIds([user._id], {
    title: 'Tài khoản mới đã được tạo',
    message: 'Tài khoản của bạn đã được khởi tạo trên hệ thống CME. Vui lòng đổi mật khẩu nếu cần.',
    type: NOTIFICATION_TYPES.ACCOUNT_CREATED,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    link: '/profile',
    createdBy: req.user._id,
    audienceType: 'USER',
    targetUsers: [user._id],
    category: 'system',
    groupKey: `account-created-${user._id.toString()}`,
  });

  if (user.role === 'DOCTOR' && user.departmentId) {
    const managers = await User.find({
      deletedAt: null,
      role: 'MANAGER',
      departmentId: user.departmentId,
    }).select('_id');
    if (managers.length > 0) {
      await notifyUsersByIds(managers.map((manager) => manager._id), {
        title: 'Bác sĩ mới được thêm vào khoa',
        message: `${user.name} vừa được tạo trong hệ thống.`,
        type: NOTIFICATION_TYPES.DOCTOR_ADDED,
        priority: NOTIFICATION_PRIORITIES.LOW,
        link: '/department-doctors',
        createdBy: req.user._id,
        audienceType: 'ROLE',
        targetRoles: ['MANAGER'],
        targetDepartments: [user.departmentId],
        category: 'admin',
        groupKey: `doctor-added-user-${user._id.toString()}`,
      });
    }
  }

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
  importUsers,
  listDepartmentDoctors,
  getDepartmentDoctorDetail,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
};
