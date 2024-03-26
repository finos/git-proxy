const proc = require('./processors');
const plugin = require('../plugin');

const pushActionChain = [
  proc.push.parsePush,
  proc.push.checkRepoInAuthorisedList,
  proc.push.checkCommitMessages,
  proc.push.checkAuthorEmails,
  proc.push.checkUserPushPermission,
  proc.push.checkIfWaitingAuth,
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.getDiff,
  proc.push.scanDiff,
  proc.push.blockForAuth,
];

let pluginsLoaded = false;

const chain = async (req) => {
  let action;
  try {
    action = await proc.pre.parseAction(req);
    const actions = await getChain(action);
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
  } finally {
    await proc.push.audit(req, action);
  }

  return action;
};

const getChain = async (action) => {
  if (action.type === 'pull') return [proc.push.checkRepoInAuthorisedList];
  if (action.type === 'push') {
    // insert loaded plugins as actions
    // this probably isn't the place to insert these functions
    const loader = await plugin.defaultLoader;
    const pluginActions = loader.plugins;
    if (!pluginsLoaded && pluginActions.length > 0) {
      console.log(`Found ${pluginActions.length}, inserting into proxy chain`);
      for (const pluginAction of pluginActions) {
        if (pluginAction instanceof plugin.ActionPlugin) {
          console.log(`Inserting plugin ${pluginAction} into chain`);
          // insert custom functions after parsePush but before other actions
          pushActionChain.splice(1, 0, pluginAction.exec);
        }
      }
      pluginsLoaded = true;
    }
    return pushActionChain;
  }
  if (action.type === 'default') return [];
};

exports.exec = chain;
