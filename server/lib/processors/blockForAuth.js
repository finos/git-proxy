const exec = (req, result) => {
  const action = {
    action: 'blockForAuth',
    ok: false,
    message: `Your push request is waiting authorisation, tracking id http://localhost:8080/requests/${result.timestamp}`,
  };

  result.ok = false;
  result.message = action.message;
  result.actionLog.push(action);

  return result;
};

exec.displayName = 'blockForAuth.exec';
exports.exec = exec;
