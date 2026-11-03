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

import { describe, it, expect, vi } from 'vitest';

// The plugin imports GitProxy as a peer dependency; point it at the in-repo sources.
vi.mock('@finos/git-proxy/plugin', () => import('../../../src/plugin'));
vi.mock('@finos/git-proxy/proxy/actions', () => import('../../../src/proxy/actions'));

const { isCompatiblePlugin, PushPhase, PullPhase } = await import('../../../src/plugin');
const { default: pushPlugin, pullPlugin } =
  await import('../../../plugins/git-proxy-plugin-supply-chain/index.js');
const { default: pullEntry } =
  await import('../../../plugins/git-proxy-plugin-supply-chain/pull.js');

describe('supply-chain plugin chain hooks', () => {
  it('registers the push scanner after the diff on the branch push chain only', () => {
    expect(isCompatiblePlugin(pushPlugin, 'isGitProxyPushActionPlugin')).toBe(true);
    expect(pushPlugin.phase).toBe(PushPhase.AFTER_DIFF);
    expect(pushPlugin.chains).toEqual(['branch']);
    expect(pushPlugin.displayName).toBe('supplyChain');
  });

  it('registers the pull scanner after the authorisation check', () => {
    expect(isCompatiblePlugin(pullPlugin, 'isGitProxyPullActionPlugin')).toBe(true);
    expect(pullPlugin.phase).toBe(PullPhase.AFTER_AUTHORISATION);
    expect(pullPlugin.displayName).toBe('supplyChainPull');
  });

  it('exposes the pull scanner as the default export of the pull entry point', () => {
    expect(pullEntry).toBe(pullPlugin);
  });
});
