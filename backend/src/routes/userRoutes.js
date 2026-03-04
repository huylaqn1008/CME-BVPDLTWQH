const { Router } = require('express');
const { body } = require('express-validator');
const { listUsers, createUser, updateUser, resetPassword, deleteUser } = require('../controllers/userController');
const auth = require('../middlewares/auth');
const roleGuard = require('../middlewares/role');
const { isStrongPassword } = require('../utils/password');

const router = Router();

router.use(auth, roleGuard('ADMIN'));

router.get('/', listUsers);
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
router.patch('/:id', updateUser);
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
