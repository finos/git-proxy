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
const { buildUsersEmailReport } = require('../lib/analyze-users.js');

describe('scripts/migrate/lib/analyze-users.js buildUsersEmailReport', () => {
  test('classifies missing vs blank vs invalid-format', () => {
    const users = [
      { _id: 'u1', username: 'noEmail' }, // missing field
      { _id: 'u2', username: 'blankEmail', email: '   ' },
      { _id: 'u3', username: 'badEmail', email: 'not-an-email' },
    ];
    const { report } = buildUsersEmailReport(users);
    const byId = new Map(report.issues.map((i: any) => [i.userId, i]));
    expect(byId.get('u1').status).toBe('missing');
    expect(byId.get('u2').status).toBe('blank');
    expect(byId.get('u3').status).toBe('invalid-format');
    expect(report.blockingIssueCount).toBe(3); // missing + blank + invalid-format
  });

  test('marks duplicate emails as duplicate and counts blocking issues', () => {
    const users = [
      { _id: 'u1', username: 'alice', email: 'dup@x.com' },
      { _id: 'u2', username: 'bob', email: 'DUP@X.COM' },
    ];
    const { report } = buildUsersEmailReport(users);
    expect(report.counts.duplicate).toBe(2);
    expect(report.blockingIssueCount).toBe(2);
    const statuses = report.issues.map((i: any) => i.status);
    expect(statuses.every((s: string) => s === 'duplicate')).toBe(true);
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.duplicateGroups[0].normalizedEmail).toBe('dup@x.com');
  });
});
