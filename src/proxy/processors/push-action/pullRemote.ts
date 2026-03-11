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

import { Action } from '../../actions';
import { PullRemoteHTTPS } from './PullRemoteHTTPS';
import { PullRemoteSSH } from './PullRemoteSSH';
import { PullRemoteBase } from './PullRemoteBase';

/**
 * Factory function to select appropriate pull remote implementation
 *
 * Strategy:
 * - SSH protocol requires agent forwarding (no fallback)
 * - HTTPS protocol uses Basic Auth credentials
 */
function createPullRemote(req: any, action: Action): PullRemoteBase {
  if (action.protocol === 'ssh') {
    if (!req?.sshClient?.agentForwardingEnabled || !req?.sshClient) {
      throw new Error(
        'SSH clone requires agent forwarding to be enabled. ' +
          'Please ensure your SSH client is configured with agent forwarding (ssh -A).',
      );
    }
    return new PullRemoteSSH();
  }

  return new PullRemoteHTTPS();
}

/**
 * Execute pull remote operation
 * Delegates to appropriate implementation based on protocol and capabilities
 */
const exec = async (req: any, action: Action): Promise<Action> => {
  const pullRemote = createPullRemote(req, action);
  return await pullRemote.exec(req, action);
};

exec.displayName = 'pullRemote.exec';
export { exec };
