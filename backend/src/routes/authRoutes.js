const { Router } = require('express');
const { body } = require('express-validator');
const { login, me, updateMe } = require('../controllers/authController');
const auth = require('../middlewares/auth');
const { isValidVietnamCccd, isValidVietnamPhone } = require('../utils/vnValidators');

const router = Router();

router.post(
  '/login',
  [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 chars'),
    body('password').isLength({ min: 1 }).withMessage('Password is required'),
  ],
  login
);
router.get('/me', auth, me);
router.patch(
  '/me',
  auth,
  [
    body('name').optional().isLength({ min: 2 }).withMessage('Họ tên phải có ít nhất 2 ký tự'),
    body('birthDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Ngày sinh không hợp lệ'),
    body('cccd')
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => isValidVietnamCccd(value))
      .withMessage('CCCD phải gồm 12 số, trong đó 3 số đầu là mã tỉnh và số thứ 4 là mã giới tính/năm sinh hợp lệ'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => isValidVietnamPhone(value))
      .withMessage('Số điện thoại phải gồm 10 số và đúng đầu số hợp lệ ở Việt Nam'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email không hợp lệ'),
  ],
  updateMe
);

module.exports = router;
