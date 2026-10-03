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

import parseDiff from 'parse-diff';

import { classifyManifest } from './manifests.js';

/**
 * @typedef {Object} ChangedManifest
 * @property {string} path repo-relative path of the changed manifest/lockfile
 * @property {string} ecosystem e.g. 'npm'
 * @property {string} kind 'manifest' | 'lockfile'
 * @property {boolean} deleted whether the file was deleted in this push
 */

/**
 * Parse a unified diff (as produced by the built-in `getDiff` step) and return the subset of
 * changed files that are recognised dependency manifests/lockfiles.
 * @param {string} diffText unified diff text
 * @return {ChangedManifest[]} changed manifests (deduplicated by path)
 */
export function changedManifestFiles(diffText) {
  if (!diffText || typeof diffText !== 'string') return [];

  let files;
  try {
    files = parseDiff(diffText);
  } catch {
    return [];
  }

  const out = [];
  const seen = new Set();
  for (const file of files) {
    const to = file.to && file.to !== '/dev/null' ? file.to : null;
    const from = file.from && file.from !== '/dev/null' ? file.from : null;
    // Use the post-image path when present; fall back to the pre-image path for deletions.
    const path = to || from;
    if (!path || seen.has(path)) continue;

    const cls = classifyManifest(path);
    if (!cls) continue;

    seen.add(path);
    out.push({
      path,
      ecosystem: cls.ecosystem,
      kind: cls.kind,
      deleted: file.deleted === true || (!to && !!from),
    });
  }
  return out;
}
