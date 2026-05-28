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

import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildUrlNormalizationReport } = require('../lib/analyze-urls.js');

describe('scripts/migrate/lib/analyze-urls.js buildUrlNormalizationReport', () => {
  test('plans .git append where missing and trims whitespace', () => {
    const repos = [
      { _id: 'r1', name: 'a', url: 'https://x/a' },
      { _id: 'r2', name: 'b', url: ' https://x/b.git ' },
    ];
    const report = buildUrlNormalizationReport(repos);
    expect(report.totalRepos).toBe(2);
    expect(report.reposNeedingUpdate).toBe(1);
    expect(report.reposAlreadyFixed).toBe(1);
    expect(report.changes).toHaveLength(1);
    expect(report.issues).toHaveLength(0);
    expect(report.changes[0]).toMatchObject({
      repoId: 'r1',
      repoName: 'a',
      oldUrl: 'https://x/a',
      newUrl: 'https://x/a.git',
      status: 'pending',
    });
  });

  test('reports blank url as issue (no change)', () => {
    const repos = [{ _id: 'r1', name: 'a', url: '   ' }];
    const report = buildUrlNormalizationReport(repos);
    expect(report.reposNeedingUpdate).toBe(0);
    expect(report.changes).toHaveLength(0);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      repoId: 'r1',
      repoName: 'a',
      rawUrl: '',
      normalizedUrl: '',
      reason: 'blank',
    });
  });

  test('strips trailing slashes before appending .git', () => {
    const repos = [{ _id: 'r1', name: 'a', url: 'https://github.com/org/repo/' }];
    const report = buildUrlNormalizationReport(repos);
    expect(report.changes).toHaveLength(1);
    expect(report.changes[0]).toMatchObject({
      oldUrl: 'https://github.com/org/repo',
      newUrl: 'https://github.com/org/repo.git',
    });
  });

  test('reports unsupported scheme as issue', () => {
    const repos = [{ _id: 'r1', name: 'a', url: 'ssh://git@github.com/org/repo' }];
    const report = buildUrlNormalizationReport(repos);
    expect(report.changes).toHaveLength(0);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      reason: 'unsupported-scheme',
      scheme: 'ssh',
    });
  });
});
