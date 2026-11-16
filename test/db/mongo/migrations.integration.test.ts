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
import {
  getAppliedMigrations,
  recordMigration,
  unrecordMigration,
} from '../../../src/db/mongo/migrations';

const shouldRunMongoTests = process.env.RUN_MONGO_TESTS === 'true';

describe.runIf(shouldRunMongoTests)('MongoDB migrations store', () => {
  it('returns no applied migrations for a fresh store', async () => {
    expect(await getAppliedMigrations()).toEqual([]);
  });

  it('records a migration so it is reported as applied', async () => {
    await recordMigration('20260701-alpha');

    expect(await getAppliedMigrations()).toEqual(['20260701-alpha']);
  });

  it('reports multiple applied migrations', async () => {
    await recordMigration('20260701-alpha');
    await recordMigration('20260702-bravo');

    expect((await getAppliedMigrations()).sort()).toEqual(['20260701-alpha', '20260702-bravo']);
  });

  it('records the same migration idempotently', async () => {
    await recordMigration('20260701-alpha');
    await recordMigration('20260701-alpha');

    expect(await getAppliedMigrations()).toEqual(['20260701-alpha']);
  });

  it('unrecords a migration so it is no longer applied', async () => {
    await recordMigration('20260701-alpha');
    await recordMigration('20260702-bravo');

    await unrecordMigration('20260701-alpha');

    expect(await getAppliedMigrations()).toEqual(['20260702-bravo']);
  });

  it('unrecording an unknown migration is a no-op', async () => {
    await unrecordMigration('does-not-exist');

    expect(await getAppliedMigrations()).toEqual([]);
  });
});
