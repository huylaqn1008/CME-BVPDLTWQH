const { Router } = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const { listUsers, importUsers, createUser, updateUser, resetPassword, deleteUser } = require('../controllers/userController');
const auth = require('../middlewares/auth');
const roleGuard = require('../middlewares/role');
const { isStrongPassword } = require('../utils/password');

const router = Router();
const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowedExt = ['.xlsx', '.xls'];
    const allowedMime = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const fileName = String(file.originalname || '').toLowerCase();
    if (allowedMime.includes(file.mimetype) || allowedExt.some((ext) => fileName.endsWith(ext))) {
      return cb(null, true);
    }
    return cb(new Error('Chỉ chấp nhận file Excel .xlsx hoặc .xls'));
  },
});
const handleExcelUpload = (req, res, next) => {
  excelUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    return next();
  });
};

router.use(auth, roleGuard('ADMIN'));

router.get('/', listUsers);
router.post('/import', handleExcelUpload, importUsers);
router.post(
  '/',
  [
    body('name').isLength({ min: 2 }).withMessage('Họ tên phải có ít nhất 2 ký tự'),
    body('username')
      .matches(/^[a-zA-Z0-9._-]{3,30}$/)
      .withMessage('Tên đăng nhập chỉ gồm chữ, số, . _ - và dài 3-30 ký tự'),
    body('password')
      .custom((value) => isStrongPassword(value))
      .withMessage('Mật khẩu phải từ 6 ký tự, có ít nhất 1 chữ in hoa và 1 ký tự đặc biệt'),
    body('role').isIn(['ADMIN', 'MANAGER', 'DOCTOR']).withMessage('Vai trò không hợp lệ'),
  ],
  createUser
);
router.patch(
  '/:id',
  [
    body('name').optional().isLength({ min: 2 }).withMessage('Họ tên phải có ít nhất 2 ký tự'),
    body('username')
      .optional()
      .matches(/^[a-zA-Z0-9._-]{3,30}$/)
      .withMessage('Tên đăng nhập chỉ gồm chữ, số, . _ - và dài 3-30 ký tự'),
    body('password')
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => isStrongPassword(value))
      .withMessage('Mật khẩu phải từ 6 ký tự, có ít nhất 1 chữ in hoa và 1 ký tự đặc biệt'),
    body('role').optional().isIn(['ADMIN', 'MANAGER', 'DOCTOR']).withMessage('Vai trò không hợp lệ'),
  ],
  updateUser
);
router.patch(
  '/:id/reset-password',
  [
    body('newPassword')
      .custom((value) => isStrongPassword(value))
      .withMessage('Mật khẩu phải từ 6 ký tự, có ít nhất 1 chữ in hoa và 1 ký tự đặc biệt'),
  ],
  resetPassword
);
router.delete('/:id', deleteUser);

module.exports = router;
