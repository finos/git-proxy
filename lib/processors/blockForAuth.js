const exec = (req, result) => {
  const action = {
    action: 'blockForAuth',
    ok: false,
    message: `Your push request is waiting authorisation, tracking id http://localhost:8080/requests/${req.timestamp}`,
  };


  result.actionLog.push(action);

  return result;
};

exec.displayName = 'checkRepoInWhiteList.exec';
exports.exec = exec;
