/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
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
import fs from 'fs'
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';

const dir = './.remote';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('pullRemote');

  try {
    action.proxyGitPath = `${dir}/${action.timestamp}`;

    step.log(`Creating folder ${action.proxyGitPath}`);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    if (!fs.existsSync(action.proxyGitPath)) {
      fs.mkdirSync(action.proxyGitPath, 0o755);
    }

    const cmd = `git clone ${action.url}`;
    step.log(`Exectuting ${cmd}`);

    const authHeader = req.headers?.authorization;
    const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64')
      .toString()
      .split(':');

    await git
      .clone({
        fs,
        http: gitHttpClient,
        url: action.url,
        onAuth: () => ({
          username,
          password,
        }),
        dir: `${action.proxyGitPath}/${action.repoName}`,
      });

    console.log('Clone Success: ', action.url);

    step.log(`Completed ${cmd}`);
    step.setContent(`Completed ${cmd}`);
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'pullRemote.exec';

export { exec };
