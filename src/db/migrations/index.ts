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

import { Sink } from '../types';

export interface Migration {
  id: string;
  up: (sink: Sink) => Promise<void>;
  down?: (sink: Sink) => Promise<void>;
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const assertUniqueIds = (migrations: Migration[]): void => {
  const seen = new Set<string>();
  for (const { id } of migrations) {
    if (seen.has(id)) {
      throw new Error(`Duplicate migration id: ${id}`);
    }
    seen.add(id);
  }
};

export const runMigrations = async (sink: Sink, migrations: Migration[]): Promise<void> => {
  assertUniqueIds(migrations);
  const applied = new Set(await sink.getAppliedMigrations());
  const pending = migrations.filter((m) => !applied.has(m.id)).sort((a, b) => byId(a.id, b.id));
  for (const migration of pending) {
    await migration.up(sink);
    // record per-migration, not in one batch, so an interrupted run resumes cleanly
    await sink.recordMigration(migration.id);
  }
};

export const rollbackMigrations = async (
  sink: Sink,
  migrations: Migration[],
  ids: string[],
): Promise<void> => {
  const applied = new Set(await sink.getAppliedMigrations());
  const byIdMap = new Map(migrations.map((m) => [m.id, m]));
  const ordered = ids
    .filter((id) => applied.has(id))
    .sort(byId)
    .reverse();
  for (const id of ordered) {
    const migration = byIdMap.get(id);
    if (!migration) {
      throw new Error(`Cannot roll back unknown migration: ${id}`);
    }
    if (!migration.down) {
      throw new Error(`Migration ${id} is irreversible (no down())`);
    }
    await migration.down(sink);
    await sink.unrecordMigration(id);
  }
};
