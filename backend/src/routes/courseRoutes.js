const { Router } = require('express');
const { body } = require('express-validator');
const {
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  listEligibleCoursesForDoctor,
  listMyCourses,
} = require('../controllers/courseController');
const auth = require('../middlewares/auth');
const roleGuard = require('../middlewares/role');

const router = Router();

router.get('/', auth, listCourses);
router.get('/my', auth, roleGuard('MANAGER', 'DOCTOR'), listMyCourses);
router.get('/eligible/me', auth, roleGuard('DOCTOR'), listEligibleCoursesForDoctor);
router.post(
  '/',
  auth,
  roleGuard('ADMIN'),
  [
    body('title').isLength({ min: 2 }),
    body('cmePoints').isNumeric(),
    body('applicableDepartments').optional().isArray(),
  ],
  createCourse
);
router.patch('/:id', auth, roleGuard('ADMIN'), updateCourse);
router.delete('/:id', auth, roleGuard('ADMIN'), deleteCourse);

module.exports = router;
