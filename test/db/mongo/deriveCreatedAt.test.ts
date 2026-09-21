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
import { ObjectId } from 'mongodb';
import { deriveCreatedAt } from '../../../src/db/mongo/migrations';

describe('mongo deriveCreatedAt', () => {
  it('derives the creation time embedded in an ObjectId', () => {
    const when = new Date('2021-06-15T12:00:00.000Z');
    const id = ObjectId.createFromTime(when.getTime() / 1000).toHexString();

    expect(deriveCreatedAt(id)).toBe(when.toISOString());
  });

  it('returns undefined for an id that is not an ObjectId', () => {
    expect(deriveCreatedAt('not-an-object-id')).toBeUndefined();
  });
});
