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

import { Action, Step } from '../../actions';
import fs from 'fs';
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';

const dir = './.remote';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('pullRemote');
  action.proxyGitPath = `${dir}/${action.id}`;

  //the specific checkout folder should not exist
  // - fail out if it does to avoid concurrent processing of conflicting requests
  if (fs.existsSync(action.proxyGitPath)) {
    const errMsg =
      'The checkout folder already exists - we may be processing a concurrent request for this push. If this issue persists the proxy may need to be restarted.';
    // do not delete the folder so that the other request can complete if its going to
    step.setError(errMsg);
    action.addStep(step);
    throw new Error(errMsg);
  } else {
    try {
      step.log(`Creating folder ${action.proxyGitPath}`);
      fs.mkdirSync(action.proxyGitPath, 0o755);

      const cmd = `git clone ${action.url}`;
      step.log(`Executing ${cmd}`);

      const authHeader = req.headers?.authorization;
      const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64')
        .toString()
        .split(':');

      // Note: setting singleBranch to true will cause issues when pushing to
      // a non-default branch as commits from those branches won't be fetched
      await git.clone({
        fs,
        http: gitHttpClient,
        url: action.url,
        dir: `${action.proxyGitPath}/${action.repoName}`,
        onAuth: () => ({ username, password }),
        depth: 1,
      });

      step.log(`Completed ${cmd}`);
      step.setContent(`Completed ${cmd}`);
    } catch (e: any) {
      step.setError(e.toString('utf-8'));

      //clean-up the check out folder so it doesn't block subsequent attempts
      fs.rmSync(action.proxyGitPath, { recursive: true, force: true });
      step.log(`.remote is deleted!`);

      throw e;
    } finally {
      action.addStep(step);
    }
  }
  return action;
};

exec.displayName = 'pullRemote.exec';

export { exec };
