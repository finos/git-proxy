const proc = require('./processors');

const pushActionChain = [
  proc.push.parsePush,
  proc.push.checkRepoInAuthorisedList,
  proc.push.checkUserPushPermission,
  proc.push.checkIfWaitingAuth,
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.getDiff,
  proc.push.sendNotificationForAuth,
  proc.push.blockForAuth,
];

const pullActionChain = [
  proc.push.checkRepoInAuthorisedList,
];

const chain = async (req) => {
  let action;
  try {
    action = await proc.pre.parseAction(req);
    const actions = getChain(action);
    for (const i in actions) {
      if (!i) continue;
      const fn = actions[i];

      action = await fn(req, action);
      if (!(action.continue())) {
        return action;
      }

      if (action.allowPush) {
        return action;
      }
    }
  } catch (e) {
    throw e;
  } finally {
    await proc.push.audit(req, action);
  }

  return action;
};

const getChain = (action) => {
  if (action.type === 'pull') return pullActionChain;
  if (action.type === 'push') return pushActionChain;
  if (action.type === 'default') return [];
};

exports.exec = chain;
