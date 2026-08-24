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

import { query } from './helper';

/**
 * PostgreSQL primary keys are random UUIDs (`gen_random_uuid()`), which carry no
 * embedded creation time. Like the filesystem backend, this backend cannot
 * recover a timestamp from an id, so callers fall back to their own default.
 */
export const deriveCreatedAt = (): string | undefined => undefined;

export const getAppliedMigrations = async (): Promise<string[]> => {
  const result = await query<{ id: string }>(`SELECT id FROM migrations`);
  return result.rows.map((row) => row.id);
};

export const recordMigration = async (id: string): Promise<void> => {
  await query(`INSERT INTO migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [id]);
};

export const unrecordMigration = async (id: string): Promise<void> => {
  await query(`DELETE FROM migrations WHERE id = $1`, [id]);
};
