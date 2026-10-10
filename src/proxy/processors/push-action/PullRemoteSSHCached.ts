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
import { CloneResult } from './PullRemoteBase';
import { PullRemoteSSH } from './PullRemoteSSH';
import { ClientWithUser } from '../../ssh/types';
import { performCachedClone } from './cachedClone';

/**
 * SSH pull remote backed by the bare repository cache.
 *
 * The cache only changes where the working copy is cloned from. Reaching the
 * remote still goes through the client's forwarded agent, exactly as in
 * PullRemoteSSH.
 */
export class PullRemoteSSHCached extends PullRemoteSSH {
  /**
   * Perform SSH clone through the cache
   */
  protected async performClone(req: any, action: Action, step: Step): Promise<CloneResult> {
    const client: ClientWithUser = req.sshClient;

    if (!client) {
      throw new Error('No SSH client available for SSH clone');
    }

    if (!client.agentForwardingEnabled) {
      throw new Error(
        'SSH clone requires agent forwarding. ' +
          'Ensure the client is connected with agent forwarding enabled.',
      );
    }

    step.log('Cloning repository over SSH through the bare repository cache');

    const access = await this.prepareRemoteAccess(req, action, step);
    try {
      return await performCachedClone(action, step, access, 'ssh-agent-forwarding');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`SSH clone failed: ${message}`);
    } finally {
      await access.cleanup!();
    }
  }
}
