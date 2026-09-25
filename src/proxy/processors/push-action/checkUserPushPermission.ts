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

import { Request } from 'express';

import { Action, Step } from '../../actions';
import { findUser, isUserPushAllowed } from '../../../db';

// Execute if the repo is approved
const exec = async (_req: Request, action: Action): Promise<Action> => {
  const step = new Step('checkUserPushPermission');
  const username = action.user;

  if (!username) {
    step.setError('Push blocked: User not found. Please contact an administrator for support.');
    action.addStep(step);
    return action;
  }

  return await validateUser(username, action, step);
};

/**
 * Helper that validates the user's push permission.
 * This can be used by other actions that need it.
 * @param {string} username The git-proxy user to validate, as set by the identity step
 * @param {Action} action The action object
 * @param {Step} step The step object
 * @return {Promise<Action>} The action object
 */
const validateUser = async (username: string, action: Action, step: Step): Promise<Action> => {
  const user = await findUser(username);
  const isUserAllowed = user ? await isUserPushAllowed(action.url, user.username) : false;

  if (!user) {
    step.log(`No user named ${username} found`);
  }

  step.log(`User ${username} permission on Repo ${action.url}: ${isUserAllowed}`);

  if (!isUserAllowed) {
    step.log(`User ${username} is not allowed to push on repo ${action.url}, ending`);
    step.setError(
      `Your push has been blocked (${username} is not allowed to push on repo ${action.url})`,
    );
    action.addStep(step);
    return action;
  }

  step.log(`User ${username} is allowed to push on repo ${action.url}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkUserPushPermission.exec';

export { exec, validateUser };
