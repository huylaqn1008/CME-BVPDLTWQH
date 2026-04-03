const { Router } = require('express');
const auth = require('../middlewares/auth');
const {
  listNotifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
  deleteReadNotifications,
  broadcastNotification,
} = require('../controllers/notificationController');
const roleGuard = require('../middlewares/role');

const router = Router();

router.use(auth);
router.get('/', listNotifications);
router.get('/unread-count', unreadCount);
router.patch('/read-all', markAllAsRead);
router.delete('/read', deleteReadNotifications);
router.patch('/:id/read', markAsRead);
router.post('/broadcast', roleGuard('ADMIN'), broadcastNotification);

module.exports = router;
