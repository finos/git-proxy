import { PluginLoader } from '../plugin';
import { Action, RequestType, ActionType } from './actions';
import * as proc from './processors';
import { attemptAutoApproval, attemptAutoRejection } from './actions/autoActions';

const branchPushChain: ((req: any, action: Action) => Promise<Action>)[] = [
  proc.push.parsePush,
  proc.push.checkEmptyBranch,
  proc.push.checkRepoInAuthorisedList,
  proc.push.checkCommitMessages,
  proc.push.checkAuthorEmails,
  proc.push.checkUserPushPermission,
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.checkHiddenCommits,
  proc.push.checkIfWaitingAuth,
  proc.push.preReceive,
  proc.push.getDiff,
  // run before clear remote
  proc.push.gitleaks,
  proc.push.clearBareClone,
  proc.push.scanDiff,
  proc.push.blockForAuth,
];

const tagPushChain: ((req: any, action: Action) => Promise<Action>)[] = [
  proc.push.checkRepoInAuthorisedList,
  proc.push.checkUserPushPermission,
  proc.push.checkIfWaitingAuth,
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.preReceive,
  // TODO: implement tag message validation?
  proc.push.blockForAuth,
];

const pullActionChain: ((req: any, action: Action) => Promise<Action>)[] = [
  proc.push.checkRepoInAuthorisedList,
];

let pluginsInserted = false;

export const executeChain = async (req: any, res: any): Promise<Action> => {
  let action: Action = {} as Action;
  try {
    // 1) Initialize basic action fields
    action = await proc.pre.parseAction(req);
    // 2) Parse the push payload first to detect tags/branches
    if (action.type === RequestType.PUSH) {
      action = await proc.push.parsePush(req, action);
    }
    // 3) Select the correct chain now that action.actionType is set
    const actionFns = await getChain(action);

    // 4) Execute each step in the selected chain
    for (const fn of actionFns) {
      action = await fn(req, action);
      if (!action.continue() || action.allowPush) {
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

/**
 * Selects the appropriate push chain based on action type
 * @param {Action} action The action to select a chain for
 * @return {Array} The appropriate push chain
 */
const getPushChain = (action: Action): ((req: any, action: Action) => Promise<Action>)[] => {
  switch (action.actionType) {
    case ActionType.TAG:
      return tagPushChain;
    case ActionType.BRANCH:
    case ActionType.COMMIT:
    default:
      return branchPushChain;
  }
};

export const getChain = async (
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
      branchPushChain.splice(1, 0, pluginObj.exec);
      tagPushChain.splice(1, 0, pluginObj.exec);
    }
    for (const pluginObj of chainPluginLoader.pullPlugins) {
      console.log(`Inserting pull plugin ${pluginObj.constructor.name} into chain`);
      // insert custom functions before other pull actions
      pullActionChain.splice(0, 0, pluginObj.exec);
    }
    // This is set to true so that we don't re-insert the plugins into the chain
    pluginsInserted = true;
  }
  switch (action.type) {
    case RequestType.PULL:
      return pullActionChain;
    case RequestType.PUSH:
      return getPushChain(action);
    default:
      return [];
  }
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
  get branchPushChain() {
    return branchPushChain;
  },
  get tagPushChain() {
    return tagPushChain;
  },
  get pullActionChain() {
    return pullActionChain;
  },
  executeChain,
  getChain,
};
