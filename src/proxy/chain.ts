/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Request, Response } from 'express';

import { PluginLoader } from '../plugin';
import { Action, RequestType, PushType } from './actions';
import * as proc from './processors';
import { Processor } from './processors/types';
import { attemptAutoApproval, attemptAutoRejection } from './actions/autoActions';
import { handleErrorAndLog } from '../utils/errors';
import { createProgressWriter } from './sideband';

const branchPushChain: Processor['exec'][] = [
  proc.push.checkEmptyBranch,
  proc.push.checkRepoInAuthorisedList,
  proc.push.checkMessages,
  proc.push.checkAuthorEmails,
  proc.push.checkUserPushPermission,
  proc.push.pullRemote, // cleanup is handled after chain execution if successful
  proc.push.writePack,
  proc.push.checkHiddenCommits,
  proc.push.checkIfWaitingAuth,
  proc.push.preReceive,
  proc.push.getDiff,
  proc.push.gitleaks,
  proc.push.scanDiff,
  proc.push.blockForAuth,
];

const tagPushChain: Processor['exec'][] = [
  proc.push.checkRepoInAuthorisedList,
  proc.push.checkUserPushPermission,
  proc.push.checkIfWaitingAuth,
  proc.push.checkMessages,
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.preReceive,
  proc.push.blockForAuth,
];

const pullActionChain: Processor['exec'][] = [proc.push.checkRepoInAuthorisedList];

const defaultActionChain: Processor['exec'][] = [proc.push.checkRepoInAuthorisedList];

/**
 * Steps whose failures are recoverable by the user (bad commit message, bad
 * author e-mail, detected secret, etc). Failures in these steps are recorded
 * but the chain keeps running so rejection reasons are reported at once.
 *
 * Steps not listed here stop the chain immediately when they fail
 * such as repository authorisation, user push permission, or later steps
 * depending on their output (pullRemote, writePack, getDiff)
 */
const collectibleSteps = new Set<Processor['exec']>([
  proc.push.checkMessages,
  proc.push.checkAuthorEmails,
  proc.push.preReceive,
  proc.push.gitleaks,
  proc.push.scanDiff,
]);

let pluginsInserted = false;

/**
 * Compose a single error message from all failed steps, so that the git
 * client displays every rejection reason for the push.
 * @param {Action} action The action whose failed steps are reported.
 * @return {string | undefined} The combined message, or undefined when there
 * are fewer than two failed steps (the single step message is kept as-is).
 */
const composeErrorMessage = (action: Action): string | undefined => {
  const messages = (action.steps ?? [])
    .filter((step) => step.error && step.errorMessage)
    .map((step) => (step.errorMessage as string).trim());

  if (messages.length < 2) {
    return undefined;
  }

  return (
    `The following ${messages.length} checks failed:\n\n` +
    messages.map((message, i) => `${i + 1}. ${message}`).join('\n\n')
  );
};

const stepProgressLabels: Record<string, string> = {
  'checkEmptyBranch.exec': 'Checking for empty branch',
  'checkRepoInAuthorisedList.exec': 'Checking repository is authorised',
  'checkMessages.exec': 'Checking commit messages',
  'checkAuthorEmails.exec': 'Checking author emails',
  'checkUserPushPermission.exec': 'Checking push permissions',
  'pullRemote.exec': 'Fetching remote repository',
  'writePack.exec': 'writing pack data',
  'checkHiddenCommits.exec': 'Checking for hidden commits',
  'checkIfWaitingAuth.exec': 'Checking approval status',
  'executeExternalPreReceiveHook.exec': 'Running pre-receive hook',
  'getDiff.exec': 'Computing diff',
  'gitleaks.exec': 'Scanning for secrets',
  'scanDiff.exec': 'Scanning diff contents',
  'blockForAuth.exec': 'Requesting approval',
};

/**
 * Obtain the message to display before a chain step.
 * @param {Processor['exec']} fn The chain step about to be executed.
 * @return {string} The message to display.
 */
const getProgressMessage = (fn: Processor['exec']): string => {
  const displayName = (fn as { displayName?: string }).displayName;
  if (displayName && stepProgressLabels[displayName]) {
    return stepProgressLabels[displayName];
  }
  if (displayName) {
    return `running ${displayName.replace(/\.exec$/, '')}`;
  }
  return 'running plugin';
};

export const executeChain = async (req: Request, res: Response): Promise<Action> => {
  let action: Action = {} as Action;
  let checkoutCleanUpRequired = false;

  try {
    // 1) Initialize basic action fields
    action = await proc.pre.parseAction(req);
    // 2) Parse refs and PACK data before chain selection
    if (action.type === RequestType.PUSH) {
      action = await proc.pre.parsePush(req, action);
    }
    // 3) Select the correct chain now that action.actionType is set
    const actionFns = await getChain(action);

    let collectedErrors = false;
    const progress = createProgressWriter(res, action);

    // 4) Execute each step in the selected chain
    for (const fn of actionFns) {
      // a push that already failed checks must not be queued for approval
      if (fn === proc.push.blockForAuth && !action.continue()) {
        break;
      }

      progress.message(`${getProgressMessage(fn)}...`);

      const stepsBefore = action.steps?.length ?? 0;
      action = await fn(req, action);

      if (action.allowPush) {
        break;
      }

      if (!action.continue()) {
        if (action.blocked) {
          break;
        }

        const failedNow = (action.steps ?? []).slice(stepsBefore).some((step) => step.error);
        if (failedNow) {
          // recoverable failures are recorded and the chain keeps running,
          // so a single push reports every rejection reason at once
          if (!collectibleSteps.has(fn)) {
            break;
          }
          collectedErrors = true;
        } else if (!collectedErrors) {
          // error that predates the chain (e.g. produced while parsing the push)
          break;
        }
      }

      if (fn === proc.push.pullRemote) {
        //if the pull was successful then record the fact we need to clean it up again
        // pullRemote should cleanup unsuccessful clones itself
        checkoutCleanUpRequired = true;
      }
    }

    if (collectedErrors) {
      const combinedMessage = composeErrorMessage(action);
      if (combinedMessage) {
        action.errorMessage = combinedMessage;
      }
    }
  } catch (error: unknown) {
    const msg = handleErrorAndLog(error, 'An unexpected error occurred when executing the chain');
    action.error = true;
    action.errorMessage = msg;
  } finally {
    //clean up the clone created
    if (checkoutCleanUpRequired) {
      action = await proc.post.clearBareClone(req, action);
    }

    action = await proc.post.audit(req, action);

    // a push that failed a later check must not be auto-approved
    if (action.autoApproved && !action.error) {
      await attemptAutoApproval(action);
    } else if (action.autoRejected) {
      await attemptAutoRejection(action);
    }
  }

  return action;
};

/**
 * The plugin loader used for the GitProxy chain.
 * @type {import('../plugin').PluginLoader}
 */
let chainPluginLoader: PluginLoader;

export const getChain = async (action: Action): Promise<Processor['exec'][]> => {
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
      branchPushChain.splice(0, 0, pluginObj.exec);
      tagPushChain.splice(0, 0, pluginObj.exec);
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
      return action.actionType === PushType.TAG ? tagPushChain : branchPushChain;
    default:
      return defaultActionChain;
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
  get defaultActionChain() {
    return defaultActionChain;
  },
  executeChain,
  getChain,
};
