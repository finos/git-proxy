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
import { PullRemoteHTTPS } from './PullRemoteHTTPS';
import { performCachedClone } from './cachedClone';

/**
 * HTTPS pull remote backed by the bare repository cache.
 *
 * Only the clone step differs from PullRemoteHTTPS: the credentials, the
 * directory setup and the error handling all stay with the parent classes.
 */
export class PullRemoteHTTPSCached extends PullRemoteHTTPS {
  /**
   * Perform HTTPS clone through the cache
   */
  protected async performClone(req: any, action: Action, step: Step): Promise<CloneResult> {
    step.log('Cloning repository over HTTPS through the bare repository cache');

    const access = await this.prepareRemoteAccess(req, action);
    return await performCachedClone(action, step, access, 'basic');
  }
}
