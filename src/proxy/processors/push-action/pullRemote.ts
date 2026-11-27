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

import { Action } from '../../actions';
import * as config from '../../../config';
import { PullRemoteHTTPS } from './PullRemoteHTTPS';
import { PullRemoteSSH } from './PullRemoteSSH';
import { PullRemoteHTTPSCached } from './PullRemoteHTTPSCached';
import { PullRemoteSSHCached } from './PullRemoteSSHCached';
import { PullRemoteBase } from './PullRemoteBase';

/**
 * Factory function to select appropriate pull remote implementation
 *
 * Strategy:
 * - SSH protocol requires agent forwarding (no fallback)
 * - HTTPS protocol uses Basic Auth credentials
 * - When the bare repository cache is enabled, the cached variant of the
 *   protocol implementation is used; when it is disabled (the default) the
 *   uncached ones are returned unchanged.
 */
export function createPullRemote(req: Request, action: Action): PullRemoteBase {
  const cached = config.isCacheEnabled();

  if (action.protocol === 'ssh') {
    if (!req?.sshClient?.agentForwardingEnabled || !req?.sshClient) {
      throw new Error(
        'SSH clone requires agent forwarding to be enabled. ' +
          'Please ensure your SSH client is configured with agent forwarding (ssh -A).',
      );
    }
    return cached ? new PullRemoteSSHCached() : new PullRemoteSSH();
  }

  return cached ? new PullRemoteHTTPSCached() : new PullRemoteHTTPS();
}

/**
 * Execute pull remote operation
 * Delegates to appropriate implementation based on protocol and capabilities
 */
const exec = async (req: Request, action: Action): Promise<Action> => {
  const pullRemote = createPullRemote(req, action);
  return await pullRemote.exec(req, action);
};

exec.displayName = 'pullRemote.exec';
export { exec };
