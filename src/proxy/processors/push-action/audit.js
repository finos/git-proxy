const db = require('../../../db');

const exec = async (req, action) => {
  await db.writeAudit(action);
  return action;
};

exec.displayName = 'audit.exec';
exports.exec = exec;

