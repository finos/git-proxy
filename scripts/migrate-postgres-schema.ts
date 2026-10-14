#!/usr/bin/env tsx

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

/**
 * Apply pending postgres schema migrations and exit.
 *
 * For deployments running with `autoMigrate: false`, where the runtime
 * database role holds no DDL rights: run this with DDL-capable credentials
 * (via the configured sink, or the standard PG* / connection-string
 * environment overrides) before starting the new GitProxy version.
 */

import { getDatabase } from '../src/config';
import { applySchemaMigrations, resetConnection } from '../src/db/postgres/helper';

const main = async (): Promise<void> => {
  const db = getDatabase();
  if (db.type !== 'postgres') {
    throw new Error(`the active sink is '${db.type}', not postgres — nothing to migrate`);
  }
  await applySchemaMigrations();
  console.log('postgres schema is up to date');
};

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => resetConnection());
