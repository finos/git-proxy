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

import { readFileSync } from 'node:fs';

/**
 * Default plugin configuration. Non-blocking by default (`failOn: 'off'`): findings are
 * surfaced on the review dashboard but the push still follows the normal approval flow.
 */
export const DEFAULT_CONFIG = {
  enabled: true,
  // 'off' | 'low' | 'medium' | 'high' | 'critical' - block the push when the highest finding
  // severity meets/exceeds this threshold. 'off' never blocks (annotate-only).
  failOn: 'off',
  ecosystems: { npm: true, python: true },
  typosquat: true,
  allowPackages: [],
  npmRegistryHosts: ['registry.npmjs.org'],
  // Pull/clone scanning. `enabled` gates the whole pull scanner; `failOn` is the block threshold
  // for clones (default 'off' = warn-only: findings are logged and the clone proceeds).
  pull: {
    enabled: true,
    failOn: 'off',
  },
};

/**
 * Merge user overrides onto the defaults (shallow, with per-key handling for nested objects).
 * @param {object} [overrides] user-supplied overrides
 * @return {object} the resolved config
 */
export function resolveConfig(overrides = {}) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  return {
    ...DEFAULT_CONFIG,
    ...o,
    ecosystems: { ...DEFAULT_CONFIG.ecosystems, ...(o.ecosystems || {}) },
    allowPackages: Array.isArray(o.allowPackages) ? o.allowPackages : DEFAULT_CONFIG.allowPackages,
    npmRegistryHosts: Array.isArray(o.npmRegistryHosts)
      ? o.npmRegistryHosts
      : DEFAULT_CONFIG.npmRegistryHosts,
    pull: { ...DEFAULT_CONFIG.pull, ...(o.pull && typeof o.pull === 'object' ? o.pull : {}) },
  };
}

/**
 * Load config from the JSON file pointed to by `$GIT_PROXY_SUPPLY_CHAIN_CONFIG`, falling back
 * to defaults when unset or unreadable.
 * @param {NodeJS.ProcessEnv} [env] environment (injectable for tests)
 * @return {object} the resolved config
 */
export function loadConfig(env = process.env) {
  const path = env.GIT_PROXY_SUPPLY_CHAIN_CONFIG;
  if (!path) return resolveConfig();
  try {
    return resolveConfig(JSON.parse(readFileSync(path, 'utf8')));
  } catch (e) {
    console.error(
      `[supply-chain] failed to read config at ${path}: ${e?.message ?? e}; using defaults`,
    );
    return resolveConfig();
  }
}
