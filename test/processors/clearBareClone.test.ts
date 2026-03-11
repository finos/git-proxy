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

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import { exec as clearBareClone } from '../../src/proxy/processors/post-processor/clearBareClone';
import { exec as pullRemote } from '../../src/proxy/processors/push-action/pullRemote';
import { Action } from '../../src/proxy/actions/Action';

const actionId = '123__456';
const timestamp = Date.now();

describe('clear bare and local clones', () => {
  it('pullRemote creates hybrid cache structure and clearBareClone removes working copy', async () => {
    let action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    action.url = 'https://github.com/finos/git-proxy.git';
    const authorization = `Basic ${Buffer.from('JamieSlome:test').toString('base64')}`;

    action = await pullRemote(
      {
        headers: {
          authorization,
        },
      },
      action,
    );

    // Hybrid cache creates: .remote/cache (bare repos) and .remote/work (working copies)
    expect(fs.existsSync(`./.remote/work/${actionId}`)).toBe(true);
    expect(fs.existsSync(`./.remote/cache/git-proxy.git`)).toBe(true);

    action = await clearBareClone(null, action);

    // clearBareClone removes only the working copy for this push
    expect(fs.existsSync(`./.remote/work/${actionId}`)).toBe(false);
    // Bare cache is preserved for subsequent pushes
    expect(fs.existsSync(`./.remote/cache/git-proxy.git`)).toBe(true);
    expect(action.steps.some((s) => s.stepName === 'clearBareClone')).toBe(true);
  }, 120000);

  afterEach(() => {
    if (fs.existsSync(`./.remote`)) {
      fs.rmSync(`./.remote`, { recursive: true });
    }
  });
});
