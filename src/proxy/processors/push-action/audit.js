const db = require('../../../db');

const exec = async (req, action) => {
  if (action.type !== 'pull') {
    await db.writeAudit(action);
  }

  return action;
};

exec.displayName = 'audit.exec';
exports.exec = exec;

