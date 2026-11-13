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

import { classifyManifest } from './manifests.js';

/**
 * From a flat list of repo-relative file paths (e.g. the output of `git ls-tree -r --name-only`),
 * return the recognised dependency manifests/lockfiles. Used for whole-tree scanning on pull,
 * where there is no diff to drive file selection.
 * @param {string[]} paths repo-relative file paths
 * @return {{path: string, ecosystem: string, kind: string, deleted: boolean}[]} manifest files
 */
export function manifestPathsFromTree(paths) {
  if (!Array.isArray(paths)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of paths) {
    const path = typeof raw === 'string' ? raw.trim() : '';
    if (!path || seen.has(path)) continue;
    const cls = classifyManifest(path);
    if (!cls) continue;
    seen.add(path);
    out.push({ path, ecosystem: cls.ecosystem, kind: cls.kind, deleted: false });
  }
  return out;
}
