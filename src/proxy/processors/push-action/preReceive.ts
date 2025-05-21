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
import fs from 'fs';
import path from 'path';
import { Action, Step } from '../../actions';
import { spawnSync } from 'child_process';

const sanitizeInput = (_req: any, action: Action): string => {
  return `${action.commitFrom} ${action.commitTo} ${action.branch} \n`;
};

const exec = async (
  req: any,
  action: Action,
  hookFilePath: string = './hooks/pre-receive.sh'
): Promise<Action> => {
  const step = new Step('executeExternalPreReceiveHook');
  let stderrTrimmed = '';

  try {
    const resolvedPath = path.resolve(hookFilePath);
    const hookDir = path.dirname(resolvedPath);

    if (!fs.existsSync(hookDir) || !fs.existsSync(resolvedPath)) {
      step.log('Pre-receive hook not found, skipping execution.');
      action.addStep(step);
      return action;
    }

    const repoPath = `${action.proxyGitPath}/${action.repoName}`;

    step.log(`Executing pre-receive hook from: ${resolvedPath}`);

    const sanitizedInput = sanitizeInput(req, action);

    const hookProcess = spawnSync(resolvedPath, [], {
      input: sanitizedInput,
      encoding: 'utf-8',
      cwd: repoPath,
    });

    const { stdout, stderr, status } = hookProcess;

    stderrTrimmed = stderr ? stderr.trim() : '';
    const stdoutTrimmed = stdout ? stdout.trim() : '';

    step.log(`Hook exited with status ${status}`);

    if (status === 0) {
      step.log('Push automatically approved by pre-receive hook.');
      action.addStep(step);
      action.setAutoApproval();
    } else if (status === 1) {
      step.log('Push automatically rejected by pre-receive hook.');
      action.addStep(step);
      action.setAutoRejection();
    } else if (status === 2) {
      step.log('Push requires manual approval.');
      action.addStep(step);
    } else {
      step.error = true;
      step.log(`Unexpected hook status: ${status}`);
      step.setError(stdoutTrimmed || 'Unknown pre-receive hook error.');
      action.addStep(step);
    }
    return action;
  } catch (error: any) {
    step.error = true;
    step.log('Push failed, pre-receive hook returned an error.');
    step.setError(`Hook execution error: ${stderrTrimmed || error.message}`);
    action.addStep(step);
    return action;
  }
};

exec.displayName = 'executeExternalPreReceiveHook.exec';

export { exec };
