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
const { collectAclOrphans } = require('../lib/analyze-acl.js');

describe('scripts/migrate/lib/analyze-acl.js collectAclOrphans', () => {
  test('finds orphans case-insensitively and ignores blanks/non-strings', () => {
    const usernameSet = new Set(['alice', 'bob']);
    const repos = [
      {
        _id: 'r1',
        name: 'repo1',
        url: 'https://example/repo1.git',
        users: {
          canPush: ['Alice', '  ', null, 'Mallory'],
          canAuthorise: ['bob', 'Eve'],
        },
      },
    ];

    const orphans = collectAclOrphans(repos, usernameSet);
    expect(orphans).toHaveLength(2);
    expect(orphans.map((o: any) => o.orphanUsername)).toEqual(['Mallory', 'Eve']);

    expect(orphans[0]).toMatchObject({
      repoId: 'r1',
      repoName: 'repo1',
      repoUrl: 'https://example/repo1.git',
      field: 'canPush',
      normalizedOrphan: 'mallory',
      index: 3,
    });
  });
});
