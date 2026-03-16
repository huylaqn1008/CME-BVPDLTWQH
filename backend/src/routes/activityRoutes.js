const { Router } = require('express');
const { getActivities } = require('../controllers/activityController');
const auth = require('../middlewares/auth');
const roleGuard = require('../middlewares/role');

const router = Router();

router.get('/', auth, roleGuard('ADMIN'), getActivities);

module.exports = router;
