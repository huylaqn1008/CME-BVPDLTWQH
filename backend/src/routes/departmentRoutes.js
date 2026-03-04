const { Router } = require('express');
const { body } = require('express-validator');
const { listDepartments, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/departmentController');
const auth = require('../middlewares/auth');
const roleGuard = require('../middlewares/role');

const router = Router();

router.get('/', auth, listDepartments);
router.post('/', auth, roleGuard('ADMIN'), [body('name').isLength({ min: 2 })], createDepartment);
router.patch('/:id', auth, roleGuard('ADMIN'), updateDepartment);
router.delete('/:id', auth, roleGuard('ADMIN'), deleteDepartment);

module.exports = router;
