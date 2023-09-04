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

let pluginsLoaded = false;

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
    // insert loaded plugins as actions
    // this probably isn't the place to insert these functions
    const pluginActions = plugin.pluginManager.plugins;
    if (!pluginsLoaded && pluginActions.length > 0) {
      console.log(`Found ${pluginActions.length}, inserting into proxy chain`);
      for (const pluginAction of pluginActions) {
        if (pluginAction instanceof plugin.GenericPlugin) {
          console.log(`Inserting plugin ${pluginAction} into chain`);
          pushActionChain.splice(1, 0, pluginAction.execute);
        }
      }
      pluginsLoaded = true;
    }
    return pushActionChain;
  }
};

exports.exec = chain;
