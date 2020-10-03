const db = require('../../../db')

const exec = (req, action) => {
  db.writeAudit(action);
  return action;
};

exec.displayName = 'audit.exec';
exports.exec = exec;
