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
import {
  DEFAULT_CONFIG,
  resolveConfig,
  loadConfig,
} from '../../../plugins/git-proxy-plugin-supply-chain/lib/config.js';

describe('resolveConfig', () => {
  it('returns defaults when given nothing', () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('merges nested ecosystems rather than replacing them', () => {
    const cfg = resolveConfig({ ecosystems: { python: true } });
    expect(cfg.ecosystems).toEqual({ npm: true, python: true });
  });

  it('honours failOn and allowPackages overrides', () => {
    const cfg = resolveConfig({ failOn: 'high', allowPackages: ['x'] });
    expect(cfg.failOn).toBe('high');
    expect(cfg.allowPackages).toEqual(['x']);
  });

  it('ignores a non-array allowPackages override', () => {
    // @ts-expect-error deliberately wrong type
    const cfg = resolveConfig({ allowPackages: 'nope' });
    expect(cfg.allowPackages).toEqual([]);
  });
});

describe('loadConfig', () => {
  it('returns defaults when the env var is unset', () => {
    expect(loadConfig({} as NodeJS.ProcessEnv)).toEqual(DEFAULT_CONFIG);
  });

  it('falls back to defaults (and logs) when the config path is unreadable', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cfg = loadConfig({
      GIT_PROXY_SUPPLY_CHAIN_CONFIG: '/no/such/file.json',
    } as NodeJS.ProcessEnv);
    expect(cfg).toEqual(DEFAULT_CONFIG);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
