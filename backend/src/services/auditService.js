const AuditLog = require('../models/AuditLog');

const writeAudit = async ({ actorId, action, entityType, entityId, meta = {} }) => {
  await AuditLog.create({ actorId, action, entityType, entityId, meta });
};

module.exports = { writeAudit };
