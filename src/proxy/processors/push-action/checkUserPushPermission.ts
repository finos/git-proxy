/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Action, Step } from '../../actions';
import { getUsers, isUserPushAllowed } from '../../../db';

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkUserPushPermission');
  const userEmail = action.userEmail;

  if (!userEmail) {
    step.setError('Push blocked: User not found. Please contact an administrator for support.');
    action.addStep(step);
    step.error = true;
    return action;
  }

  return await validateUser(userEmail, action, step);
};

/**
 * Helper that validates the user's push permission.
 * This can be used by other actions that need it.
 * @param {string} userEmail The user to validate
 * @param {Action} action The action object
 * @param {Step} step The step object
 * @return {Promise<Action>} The action object
 */
const validateUser = async (userEmail: string, action: Action, step: Step): Promise<Action> => {
  let isUserAllowed = false;

  // Find the user associated with this email address
  const list = await getUsers({ email: userEmail });

  if (list.length > 1) {
    console.error(`Multiple users found with email address ${userEmail}, ending`);
    step.error = true;
    step.log(
      `Multiple Users have email <${userEmail}> so we cannot uniquely identify the user, ending`,
    );

    step.setError(
      `Your push has been blocked (there are multiple users with email ${action.userEmail})`,
    );
    action.addStep(step);
    return action;
  } else if (list.length == 0) {
    console.error(`No user with email address ${userEmail} found`);
  } else {
    isUserAllowed = await isUserPushAllowed(action.url, list[0].username);
  }

  console.log(`User ${userEmail} permission on Repo ${action.url} : ${isUserAllowed}`);

  if (!isUserAllowed) {
    console.log('User not allowed to Push');
    step.error = true;
    step.log(`User ${userEmail} is not allowed to push on repo ${action.url}, ending`);
    step.setError(
      `Your push has been blocked (${action.userEmail} ` +
        `is not allowed to push on repo ` +
        `${action.url})`,
    );
    action.addStep(step);
    return action;
  }

  step.log(`User ${userEmail} is allowed to push on repo ${action.url}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkUserPushPermission.exec';

export { exec, validateUser };
