const { Router } = require('express');
const { body } = require('express-validator');
const { login, me } = require('../controllers/authController');
const auth = require('../middlewares/auth');

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

module.exports = router;
