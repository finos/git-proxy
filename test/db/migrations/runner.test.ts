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

import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations, rollbackMigrations } from '../../../src/db/migrations';
import type { Migration } from '../../../src/db/migrations';
import type { Sink } from '../../../src/db/types';

interface FakeSink {
  sink: Sink;
  applied: () => string[];
}

// The runner is backend-agnostic: it only ever calls getAppliedMigrations /
// recordMigration / unrecordMigration plus each migration's up()/down().
const makeSink = (initiallyApplied: string[] = []): FakeSink => {
  const applied = new Set(initiallyApplied);
  const sink = {
    getAppliedMigrations: async () => [...applied],
    recordMigration: async (id: string) => {
      applied.add(id);
    },
    unrecordMigration: async (id: string) => {
      applied.delete(id);
    },
  } as unknown as Sink;
  return { sink, applied: () => [...applied] };
};

const makeMigration = (id: string, log: string[]): Migration => ({
  id,
  up: async () => {
    log.push(`up:${id}`);
  },
  down: async () => {
    log.push(`down:${id}`);
  },
});

const A = '20260701-alpha';
const B = '20260702-bravo';
const C = '20260703-charlie';

describe('runMigrations', () => {
  let log: string[];

  beforeEach(() => {
    log = [];
  });

  it('applies every unapplied migration in id order on a fresh db', async () => {
    const { sink, applied } = makeSink();
    const migrations = [C, A, B].map((id) => makeMigration(id, log)); // deliberately unsorted

    await runMigrations(sink, migrations);

    expect(log).toEqual([`up:${A}`, `up:${B}`, `up:${C}`]);
    expect(applied()).toEqual([A, B, C]);
  });

  it('skips migrations already recorded as applied', async () => {
    const { sink } = makeSink([A, B]);
    const migrations = [A, B, C].map((id) => makeMigration(id, log));

    await runMigrations(sink, migrations);

    expect(log).toEqual([`up:${C}`]);
  });

  it('is a no-op when everything is already applied', async () => {
    const { sink } = makeSink([A, B, C]);
    const migrations = [A, B, C].map((id) => makeMigration(id, log));

    await runMigrations(sink, migrations);

    expect(log).toEqual([]);
  });

  // The reason this model exists: a migration authored on a parallel branch
  // lands with an id that sorts *before* one already applied on main. A single
  // "current version" integer would skip it; tracking applied ids does not.
  it('applies a lower-id migration merged in after a higher-id one already ran', async () => {
    const { sink, applied } = makeSink([C]);
    const migrations = [A, B, C].map((id) => makeMigration(id, log));

    await runMigrations(sink, migrations);

    expect(log).toEqual([`up:${A}`, `up:${B}`]);
    expect(applied().sort()).toEqual([A, B, C]);
  });

  it('records each migration as it is applied, not in a single batch at the end', async () => {
    const recorded: string[] = [];
    const applied = new Set<string>();
    const sink = {
      getAppliedMigrations: async () => [...applied],
      recordMigration: async (id: string) => {
        recorded.push(id);
        applied.add(id);
      },
    } as unknown as Sink;

    await runMigrations(
      sink,
      [A, B, C].map((id) => makeMigration(id, log)),
    );

    expect(recorded).toEqual([A, B, C]);
  });

  it('throws when two migrations share an id', async () => {
    const { sink } = makeSink();
    const migrations = [makeMigration(A, log), makeMigration(A, log)];

    await expect(runMigrations(sink, migrations)).rejects.toThrow(/duplicate/i);
  });
});

describe('rollbackMigrations', () => {
  let log: string[];

  beforeEach(() => {
    log = [];
  });

  it('rolls back the given applied migrations in reverse id order', async () => {
    const { sink, applied } = makeSink([A, B, C]);
    const migrations = [A, B, C].map((id) => makeMigration(id, log));

    await rollbackMigrations(sink, migrations, [B, C]);

    expect(log).toEqual([`down:${C}`, `down:${B}`]);
    expect(applied()).toEqual([A]);
  });

  it('ignores ids that were never applied', async () => {
    const { sink, applied } = makeSink([A]);
    const migrations = [A, B, C].map((id) => makeMigration(id, log));

    await rollbackMigrations(sink, migrations, [B, C]);

    expect(log).toEqual([]);
    expect(applied()).toEqual([A]);
  });

  it('throws when asked to roll back a migration that has no down()', async () => {
    const { sink } = makeSink([A]);
    const migrations: Migration[] = [{ id: A, up: async () => {} }];

    await expect(rollbackMigrations(sink, migrations, [A])).rejects.toThrow(/irreversible|down/i);
  });

  // An id can be recorded as applied (in the db) but no longer exist in the
  // current migrations list, e.g. its source file was deleted or renamed.
  it('throws when asked to roll back an id that is applied but no longer defined', async () => {
    const UNKNOWN = '20260704-unknown';
    const { sink } = makeSink([A, UNKNOWN]);
    const migrations = [A].map((id) => makeMigration(id, log));

    await expect(rollbackMigrations(sink, migrations, [UNKNOWN])).rejects.toThrow(
      `Cannot roll back unknown migration: ${UNKNOWN}`,
    );
  });
});
