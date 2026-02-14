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
import simpleGit from 'simple-git';
import { EMPTY_COMMIT_HASH } from '../constants';

const isEmptyBranch = async (action: Action) => {
  if (action.commitFrom === EMPTY_COMMIT_HASH) {
    try {
      const git = simpleGit(`${action.proxyGitPath}/${action.repoName}`);

      const type = await git.raw(['cat-file', '-t', action.commitTo || '']);
      return type.trim() === 'commit';
    } catch (err) {
      console.log(`Commit ${action.commitTo} not found: ${err}`);
    }
  }

  return false;
};

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkEmptyBranch');

  if (action.commitData && action.commitData.length > 0) {
    return action;
  }

  if (await isEmptyBranch(action)) {
    step.setError('Push blocked: Empty branch. Please make a commit before pushing a new branch.');
    action.addStep(step);
    step.error = true;
    return action;
  } else {
    step.setError(
      'Push blocked: Commit data not found. Please contact an administrator for support.',
    );
    action.addStep(step);
    step.error = true;
    return action;
  }
};

exec.displayName = 'checkEmptyBranch.exec';

export { exec };
