import { PluginLoader } from '../plugin';
import { Action } from './actions';
import * as proc from './processors';
import { attemptAutoApproval, attemptAutoRejection } from './actions/autoActions';

const pushActionChain: ((req: any, action: Action) => Promise<Action>)[] = [
  proc.push.parsePush,
  proc.push.checkRepoInAuthorisedList,
  proc.push.checkCommitMessages,
  proc.push.checkAuthorEmails,
  proc.push.checkUserPushPermission,
  proc.push.checkIfWaitingAuth,
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.preReceive,
  proc.push.getDiff,
  // run before clear remote
  proc.push.gitleaks,
  proc.push.clearBareClone,
  proc.push.scanDiff,
  proc.push.blockForAuth,
];

const pullActionChain: ((req: any, action: Action) => Promise<Action>)[] = [
  proc.push.checkRepoInAuthorisedList,
];

let pluginsInserted = false;

export const executeChain = async (req: any, res: any): Promise<Action> => {
  let action: Action = {} as Action;
  try {
    action = await proc.pre.parseAction(req);
    const actionFns = await getChain(action);

    for (const fn of actionFns) {
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
    if (action.autoApproved) {
      attemptAutoApproval(action);
    } else if (action.autoRejected) {
      attemptAutoRejection(action);
    }
  }

  return action;
};

/**
 * The plugin loader used for the GitProxy chain.
 * @type {import('../plugin').PluginLoader}
 */
let chainPluginLoader: PluginLoader;

const getChain = async (
  action: Action,
): Promise<((req: any, action: Action) => Promise<Action>)[]> => {
  if (chainPluginLoader === undefined) {
    console.error(
      'Plugin loader was not initialized! This is an application error. Please report it to the GitProxy maintainers. Skipping plugins...',
    );
    pluginsInserted = true;
  }
  if (!pluginsInserted) {
    console.log(
      `Inserting loaded plugins (${chainPluginLoader.pushPlugins.length} push, ${chainPluginLoader.pullPlugins.length} pull) into proxy chains`,
    );
    for (const pluginObj of chainPluginLoader.pushPlugins) {
      console.log(`Inserting push plugin ${pluginObj.constructor.name} into chain`);
      // insert custom functions after parsePush but before other actions
      pushActionChain.splice(1, 0, pluginObj.exec);
    }
    for (const pluginObj of chainPluginLoader.pullPlugins) {
      console.log(`Inserting pull plugin ${pluginObj.constructor.name} into chain`);
      // insert custom functions before other pull actions
      pullActionChain.splice(0, 0, pluginObj.exec);
    }
    // This is set to true so that we don't re-insert the plugins into the chain
    pluginsInserted = true;
  }
  if (action.type === 'pull') return pullActionChain;
  if (action.type === 'push') return pushActionChain;
  return [];
};

export default {
  set chainPluginLoader(loader) {
    chainPluginLoader = loader;
  },
  get chainPluginLoader() {
    return chainPluginLoader;
  },
  get pluginsInserted() {
    return pluginsInserted;
  },
  get pushActionChain() {
    return pushActionChain;
  },
  get pullActionChain() {
    return pullActionChain;
  },
  executeChain,
  getChain,
};
