const { Router } = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const auth = require('../middlewares/auth');

const router = Router();
router.get('/', auth, getDashboard);

module.exports = router;
