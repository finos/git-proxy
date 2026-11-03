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
const { normalizeEmail, isEmailFormatValid } = require('../lib/email.js');

describe('scripts/migrate/lib/email.js', () => {
  describe('normalizeEmail trims, lowercases, and coerces falsy to empty string', () => {
    test.each([
      [null, ''],
      [undefined, ''],
      ['', ''],
      ['   ', ''],
    ])('returns %j when input is %j', (input, expected) => {
      expect(normalizeEmail(input)).toBe(expected);
    });
  });

  describe('isEmailFormatValid applies a basic format check after normalization', () => {
    describe('accepts addresses that match the migration regex', () => {
      test.each(['a@b.c', 'user+tag@example.com', 'alice@mail.example.com'])(
        'treats %s as valid',
        (email) => {
          expect(isEmailFormatValid(email)).toBe(true);
        },
      );
    });

    describe('rejects addresses that fail the migration regex', () => {
      test.each(['', 'a@b', '@x.com', 'a@', 'a @b.com', 'a@@b.com'])(
        'treats %s as invalid',
        (email) => {
          expect(isEmailFormatValid(email)).toBe(false);
        },
      );
    });
  });
});
