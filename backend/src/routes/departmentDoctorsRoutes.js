const { Router } = require('express');
const { listDepartmentDoctors, getDepartmentDoctorDetail } = require('../controllers/userController');
const auth = require('../middlewares/auth');
const roleGuard = require('../middlewares/role');

const router = Router();

router.get('/', auth, roleGuard('MANAGER'), listDepartmentDoctors);
router.get('/:id', auth, roleGuard('MANAGER'), getDepartmentDoctorDetail);

module.exports = router;
