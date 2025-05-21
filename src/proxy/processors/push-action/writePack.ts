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
import { spawnSync } from 'child_process';

const exec = async (req: any, action: Action) => {
  const step = new Step('writePack');
  try {
    const cmd = `git receive-pack ${action.repoName}`;
    step.log(`executing ${cmd}`);

    const content = spawnSync('git', ['receive-pack', action.repoName], {
      cwd: action.proxyGitPath,
      input: req.body,
      encoding: 'utf-8',
    }).stdout;

    step.log(content);
    step.setContent(content);
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
