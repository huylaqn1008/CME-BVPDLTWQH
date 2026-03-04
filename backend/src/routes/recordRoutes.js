const { Router } = require('express');
const { body } = require('express-validator');
const {
  listRecords,
  listApprovalQueue,
  createExternalRecord,
  doctorResubmitRejectedRecord,
  doctorDeleteRejectedRecord,
  createInternalCompletion,
  managerReview,
  adminReview,
  getCertificates,
  getSummary,
  downloadEvidence,
} = require('../controllers/recordController');
const auth = require('../middlewares/auth');
const roleGuard = require('../middlewares/role');
const upload = require('../middlewares/upload');

const router = Router();

router.get('/', auth, listRecords);
router.get('/approval-queue', auth, roleGuard('MANAGER', 'ADMIN'), listApprovalQueue);
router.get('/summary', auth, getSummary);
router.get('/certificates', auth, getCertificates);
router.get('/:id/evidence', auth, downloadEvidence);

router.post(
  '/external',
  auth,
  roleGuard('DOCTOR'),
  upload.single('evidence'),
  [body('courseId').isMongoId().withMessage('Khóa học không hợp lệ')],
  createExternalRecord
);
router.patch(
  '/:id/doctor-resubmit',
  auth,
  roleGuard('DOCTOR'),
  upload.single('evidence'),
  [body('courseId').isMongoId().withMessage('Khóa học không hợp lệ')],
  doctorResubmitRejectedRecord
);
router.delete('/:id/doctor-delete', auth, roleGuard('DOCTOR'), doctorDeleteRejectedRecord);
router.post('/internal/complete', auth, roleGuard('ADMIN'), [body('userId').isMongoId(), body('courseId').isMongoId()], createInternalCompletion);
router.patch(
  '/:id/manager-review',
  auth,
  roleGuard('MANAGER'),
  [
    body('status').isIn(['approve', 'reject']),
    body('note').trim().isLength({ min: 5 }).withMessage('Giải trình phải có ít nhất 5 ký tự'),
  ],
  managerReview
);
router.patch(
  '/:id/admin-review',
  auth,
  roleGuard('ADMIN'),
  [
    body('status').isIn(['approve', 'reject']),
    body('note').trim().isLength({ min: 5 }).withMessage('Giải trình phải có ít nhất 5 ký tự'),
  ],
  adminReview
);

module.exports = router;
