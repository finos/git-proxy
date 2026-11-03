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
const { simulatePostApplyUniqueness } = require('../lib/apply-user-emails.js');

describe('scripts/migrate/lib/apply-user-emails.js simulatePostApplyUniqueness', () => {
  test('detects duplicates already present in DB state', () => {
    const users = [
      { _id: 'u1', username: 'alice', email: 'dup@x.com' },
      { _id: 'u2', username: 'bob', email: 'dup@x.com' },
    ];
    const mapping = new Map();
    const { conflicts } = simulatePostApplyUniqueness(users, mapping);
    expect(conflicts).toEqual([{ normalizedEmail: 'dup@x.com', userIds: ['u1', 'u2'] }]);
  });

  test('detects conflicts introduced by mapping', () => {
    const users = [
      { _id: 'u1', username: 'alice', email: 'a@x.com' },
      { _id: 'u2', username: 'bob', email: 'b@x.com' },
    ];
    const mapping = new Map([
      ['alice', 'same@x.com'],
      ['bob', 'same@x.com'],
    ]);
    const { conflicts } = simulatePostApplyUniqueness(users, mapping);
    expect(conflicts).toEqual([{ normalizedEmail: 'same@x.com', userIds: ['u1', 'u2'] }]);
  });

  test('mapping key is matched against normalized username', () => {
    const users = [{ _id: 'u1', username: 'Alice', email: 'old@x.com' }];
    const mapping = new Map([['alice', 'NEW@X.COM ']]);
    const { conflicts, projected } = simulatePostApplyUniqueness(users, mapping);
    expect(conflicts).toEqual([]);
    expect(projected.get('u1')).toBe('new@x.com');
  });
});
