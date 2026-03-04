const { validationResult } = require('express-validator');
const Department = require('../models/Department');
const { writeAudit } = require('../services/auditService');

const listDepartments = async (_req, res) => {
  const departments = await Department.find({ deletedAt: null }).sort({ name: 1 });
  return res.json(departments);
};

const createDepartment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const department = await Department.create(req.body);
  await writeAudit({ actorId: req.user._id, action: 'CREATE_DEPARTMENT', entityType: 'Department', entityId: department._id.toString() });
  return res.status(201).json(department);
};

const updateDepartment = async (req, res) => {
  const department = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!department) return res.status(404).json({ message: 'Department not found' });
  return res.json(department);
};

const deleteDepartment = async (req, res) => {
  const department = await Department.findByIdAndUpdate(req.params.id, { deletedAt: new Date() }, { new: true });
  if (!department) return res.status(404).json({ message: 'Department not found' });
  return res.json({ message: 'Department deleted' });
};

module.exports = { listDepartments, createDepartment, updateDepartment, deleteDepartment };
