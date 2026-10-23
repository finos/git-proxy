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

import { describe, expect, it } from 'vitest';
import { parseReviewTimestamp } from '../../src/ui/utils/parseReviewTimestamp';

describe('review timestamps', () => {
  it.each([
    1791792000000,
    '1791792000000',
    '2026-10-12T08:00:00.000Z',
    new Date('2026-10-12T08:00:00.000Z'),
  ])('renders the same instant for %s', (timestamp) => {
    expect(parseReviewTimestamp(timestamp).toUTC().toISO()).toBe('2026-10-12T08:00:00.000Z');
  });

  it('preserves invalid timestamps as invalid dates', () => {
    expect(parseReviewTimestamp('invalid').isValid).toBe(false);
  });
});
