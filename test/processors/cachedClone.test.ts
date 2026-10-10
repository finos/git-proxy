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

import { describe, it, expect, afterEach, vi } from 'vitest';

import * as config from '../../src/config';
import { Action, RequestType } from '../../src/proxy/actions/Action';
import { cacheKeyFor } from '../../src/proxy/processors/push-action/cachedClone';
import { createPullRemote } from '../../src/proxy/processors/push-action/pullRemote';
import { PullRemoteHTTPS } from '../../src/proxy/processors/push-action/PullRemoteHTTPS';
import { PullRemoteSSH } from '../../src/proxy/processors/push-action/PullRemoteSSH';
import { PullRemoteHTTPSCached } from '../../src/proxy/processors/push-action/PullRemoteHTTPSCached';
import { PullRemoteSSHCached } from '../../src/proxy/processors/push-action/PullRemoteSSHCached';

const actionFor = (url: string): Action =>
  new Action('id', RequestType.PUSH, 'POST', Date.now(), url);

const sshReq = { sshClient: { agentForwardingEnabled: true } } as any;

describe('cacheKeyFor', () => {
  it('keeps repositories from different projects apart', () => {
    const finos = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');
    const other = actionFor('/github.com/acme/git-proxy.git/git-receive-pack');

    expect(finos.repoName).toBe(other.repoName);
    expect(cacheKeyFor(finos)).not.toBe(cacheKeyFor(other));
  });

  it('includes the project in the key', () => {
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');

    expect(cacheKeyFor(action)).toBe('finos__git-proxy.git');
  });

  it('falls back to the repository name when there is no project', () => {
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');
    action.project = '';

    expect(cacheKeyFor(action)).toBe('git-proxy.git');
  });

  it('produces a flat, filesystem-safe name', () => {
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');
    const key = cacheKeyFor(action);

    expect(key).not.toContain('/');
    expect(key).toMatch(/^[\w.-]+$/);
  });
});

describe('createPullRemote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the uncached implementations when the cache is disabled', () => {
    vi.spyOn(config, 'isCacheEnabled').mockReturnValue(false);
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');

    const https = createPullRemote({ headers: {} } as any, action);
    expect(https).toBeInstanceOf(PullRemoteHTTPS);
    expect(https).not.toBeInstanceOf(PullRemoteHTTPSCached);

    action.protocol = 'ssh';
    const ssh = createPullRemote(sshReq, action);
    expect(ssh).toBeInstanceOf(PullRemoteSSH);
    expect(ssh).not.toBeInstanceOf(PullRemoteSSHCached);
  });

  it('returns the cached implementations when the cache is enabled', () => {
    vi.spyOn(config, 'isCacheEnabled').mockReturnValue(true);
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');

    expect(createPullRemote({ headers: {} } as any, action)).toBeInstanceOf(PullRemoteHTTPSCached);

    action.protocol = 'ssh';
    expect(createPullRemote(sshReq, action)).toBeInstanceOf(PullRemoteSSHCached);
  });

  it('still requires agent forwarding for SSH regardless of the cache', () => {
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');
    action.protocol = 'ssh';

    for (const enabled of [false, true]) {
      vi.spyOn(config, 'isCacheEnabled').mockReturnValue(enabled);
      expect(() => createPullRemote({ sshClient: undefined } as any, action)).toThrow(
        /agent forwarding/,
      );
    }
  });
});
