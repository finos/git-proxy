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

import { analyzeNpm } from './ecosystems/npm.js';
import { analyzePython } from './ecosystems/python.js';
import { analyzeGo } from './ecosystems/go.js';
import { maxSeverity } from './severity.js';

// Registry of per-ecosystem analyzers. Add go/cargo/... here as they are implemented.
const ANALYZERS = {
  npm: analyzeNpm,
  python: analyzePython,
  go: analyzeGo,
};

/**
 * Read a file revision without throwing.
 * @param {(path: string, rev: 'old'|'new') => Promise<?string>} readFile reader
 * @param {string} path file path
 * @param {'old'|'new'} rev which revision
 * @return {Promise<?string>} content or null
 */
async function safeRead(readFile, path, rev) {
  try {
    return await readFile(path, rev);
  } catch {
    return null;
  }
}

/**
 * Run the appropriate ecosystem analyzer over each changed manifest and aggregate findings.
 * @param {{
 *   files: import('./diff.js').ChangedManifest[],
 *   readFile: (path: string, rev: 'old'|'new') => Promise<?string>,
 *   config: object,
 * }} args changed files, a revision reader, and resolved config
 * @return {Promise<{findings: import('./findings.js').Finding[], maxSeverity: string}>} results
 */
export async function analyzeChangedFiles({ files, readFile, config }) {
  const findings = [];

  for (const file of files) {
    const analyze = ANALYZERS[file.ecosystem];
    if (!analyze) continue;
    if (file.deleted) continue; // nothing to scan when the manifest is removed

    const [oldContent, newContent] = await Promise.all([
      safeRead(readFile, file.path, 'old'),
      safeRead(readFile, file.path, 'new'),
    ]);
    if (newContent == null) continue; // couldn't read the new content

    findings.push(
      ...analyze({
        path: file.path,
        kind: file.kind,
        oldContent,
        newContent,
        config,
      }),
    );
  }

  return { findings, maxSeverity: maxSeverity(findings.map((f) => f.severity)) };
}
