const proc = require('./processors');
const plugin = require('../plugin');

const pushActionChain = [
  proc.push.parsePush,
  proc.push.checkRepoInAuthorisedList,
  proc.push.checkIfWaitingAuth,
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.getDiff,
  proc.push.blockForAuth,
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

      if (!action.continue()) {
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
  if (action.type === 'pull') return [];
  if (action.type === 'push') {
    console.log('Checking for plugin actions');
    // plugin.pluginManager is a Promise. How to get pluginManager.plugins if
    // its lazily loaded and initalized async???
    const pluginActions = plugin.pluginManager
      .then((pm) => (pm.loaded ? pm.plugins : []))
      .catch((err) => {
        console.error(err);
        return [];
      });
    // insert loaded plugins as actions
    // this probably isn't the place to insert these functions
    if (pluginActions.length > 0) {
      console.log(`Found ${pluginActions.length}, upserting into proxy chain`);
      pushActionChain = pushActionChain.splice(1, 0, ...pluginActions);
      console.log(pushActionChain);
    }
    return pushActionChain;
  }
};

exports.exec = chain;
