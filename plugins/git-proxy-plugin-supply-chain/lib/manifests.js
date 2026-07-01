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

/**
 * Known dependency manifest / lockfile basenames mapped to an ecosystem and kind.
 * Additional ecosystems (python, go, cargo, ...) are added here as they are implemented.
 * @type {{name: string, ecosystem: string, kind: 'manifest' | 'lockfile'}[]}
 */
const BASENAME_RULES = [
  { name: 'package.json', ecosystem: 'npm', kind: 'manifest' },
  { name: 'package-lock.json', ecosystem: 'npm', kind: 'lockfile' },
  { name: 'npm-shrinkwrap.json', ecosystem: 'npm', kind: 'lockfile' },
  { name: 'yarn.lock', ecosystem: 'npm', kind: 'lockfile' },
  { name: 'pnpm-lock.yaml', ecosystem: 'npm', kind: 'lockfile' },
];

/**
 * Classify a repository file path as a known dependency manifest/lockfile.
 * @param {string} path repo-relative file path (POSIX or Windows separators)
 * @return {{ecosystem: string, kind: string} | null} classification or null if not a manifest
 */
export function classifyManifest(path) {
  if (!path || typeof path !== 'string') return null;
  const base = path.replace(/\\/g, '/').split('/').pop();
  const rule = BASENAME_RULES.find((r) => r.name === base);
  return rule ? { ecosystem: rule.ecosystem, kind: rule.kind } : null;
}
