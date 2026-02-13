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

import path from 'path';
import { Action, Step } from '../../actions';
import { spawnSync } from 'child_process';
import fs from 'fs';

const exec = async (req: any, action: Action) => {
  const step = new Step('writePack');
  try {
    if (!action.proxyGitPath || !action.repoName) {
      throw new Error('proxyGitPath and repoName must be defined');
    }
    const repoPath = path.join(action.proxyGitPath, action.repoName);

    const packDir = path.join(repoPath, '.git', 'objects', 'pack');

    spawnSync('git', ['config', 'receive.unpackLimit', '0'], {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    const before = new Set(fs.readdirSync(packDir).filter((f) => f.endsWith('.idx')));
    const content = spawnSync('git', ['receive-pack', action.repoName], {
      cwd: action.proxyGitPath,
      input: req.body,
    });
    const newIdxFiles = [
      ...new Set(fs.readdirSync(packDir).filter((f) => f.endsWith('.idx') && !before.has(f))),
    ];
    action.newIdxFiles = newIdxFiles;
    step.log(`new idx files: ${newIdxFiles}`);
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'writePack.exec';

export { exec };
