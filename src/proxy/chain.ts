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

import { PluginLoader, ActionPlugin, PushActionPlugin } from '../plugin';
import { Action, RequestType, PushType } from './actions';
import * as proc from './processors';
import {
  ProcessorExec,
  PullPhase,
  PushPhase,
  ChainElement,
  PushChainName,
  BuiltChains,
} from './processors/types';
import { attemptAutoApproval, attemptAutoRejection } from './actions/autoActions';
import { handleErrorAndLog } from '../utils/errors';
import { createProgressWriter } from './sideband';

const branchPushChainElements: ChainElement[] = [
  proc.push.resolveUserFromToken,
  proc.push.checkEmptyBranch,
  proc.push.checkRepoInAuthorisedList,
  PushPhase.AFTER_PERMISSIONS,
  proc.push.checkMessages,
  proc.push.checkAuthorEmails,
  proc.push.checkUserPushPermission,
  proc.push.pullRemote, // cleanup is handled after chain execution if successful
  proc.push.writePack,
  PushPhase.AFTER_CHECKOUT,
  proc.push.checkHiddenCommits,
  proc.push.checkIfWaitingAuth,
  proc.push.preReceive,
  proc.push.getDiff,
  PushPhase.AFTER_DIFF,
  proc.push.gitleaks,
  proc.push.scanDiff,
  PushPhase.BEFORE_APPROVAL,
  proc.push.blockForAuth,
];

const tagPushChainElements: ChainElement[] = [
  proc.push.checkRepoInAuthorisedList,
  PushPhase.AFTER_PERMISSIONS,
  proc.push.checkUserPushPermission,
  proc.push.checkIfWaitingAuth,
  proc.push.checkMessages,
  proc.push.pullRemote,
  proc.push.writePack,
  PushPhase.AFTER_CHECKOUT,
  proc.push.preReceive,
  PushPhase.BEFORE_APPROVAL,
  proc.push.blockForAuth,
];

const pullActionChainElements: ChainElement[] = [
  proc.push.checkRepoInAuthorisedList,
  PullPhase.AFTER_AUTHORISATION,
];

const defaultActionChainElements: ChainElement[] = [proc.push.checkRepoInAuthorisedList];

let builtChains: BuiltChains | undefined;

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
 * @param {ProcessorExec} fn The chain step about to be executed.
 * @return {string} The message to display.
 */
const getProgressMessage = (fn: ProcessorExec): string => {
  const { displayName } = fn;
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
          // collectible steps have their failures can report all their
          // rejection reasons at once, non-collectible steps fail immediately
          if (!fn.isCollectible) {
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

const buildChain = (
  elements: ChainElement[],
  chainName: string,
  plugins: ActionPlugin[],
): ProcessorExec[] =>
  elements.flatMap((element) =>
    typeof element === 'function'
      ? [element]
      : plugins.filter((plugin) => plugin.phase === element).map((plugin) => plugin.exec),
  );

const filterPushPluginsByChain = (plugins: readonly PushActionPlugin[], chainName: PushChainName) =>
  plugins.filter((p) => (p.chains ?? ['branch', 'tag']).includes(chainName));

const buildAllChains = (): BuiltChains => {
  const pushPlugins = chainPluginLoader.pushPlugins;
  const pullPlugins = chainPluginLoader.pullPlugins;

  return {
    branch: buildChain(
      branchPushChainElements,
      'branch',
      filterPushPluginsByChain(pushPlugins, 'branch'),
    ),
    tag: buildChain(tagPushChainElements, 'tag', filterPushPluginsByChain(pushPlugins, 'tag')),
    pull: buildChain(pullActionChainElements, 'pull', pullPlugins),
    default: [...defaultActionChainElements] as ProcessorExec[],
  };
};

export const getChain = async (action: Action): Promise<ProcessorExec[]> => {
  if (chainPluginLoader === undefined) {
    throw new Error(
      'Plugin loader was not initialized! This is an application error. Please report it to the GitProxy maintainers.',
    );
  }

  builtChains ??= buildAllChains();

  switch (action.type) {
    case RequestType.PULL:
      return builtChains.pull;
    case RequestType.PUSH:
      return action.actionType === PushType.TAG ? builtChains.tag : builtChains.branch;
    default:
      return builtChains.default;
  }
};

export default {
  set chainPluginLoader(loader) {
    chainPluginLoader = loader;
  },
  get chainPluginLoader() {
    return chainPluginLoader;
  },
  get branchPushChain() {
    return builtChains?.branch ?? [];
  },
  get tagPushChain() {
    return builtChains?.tag ?? [];
  },
  get pullActionChain() {
    return builtChains?.pull ?? [];
  },
  get defaultActionChain() {
    return builtChains?.default ?? [];
  },
  executeChain,
  getChain,
};
