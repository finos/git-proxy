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

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getDatabase } from '../src/config';
import * as postgres from '../src/db/postgres';
import { migrate, MigrationSource } from '../src/db/postgres/migrate';
import { createFileSource } from '../src/db/postgres/migrateFileSource';
import { createMongoSource } from '../src/db/postgres/migrateMongoSource';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --from <mongo|fs> [options]')
  .option('from', {
    choices: ['mongo', 'fs'] as const,
    demandOption: true,
    describe: 'Source backend to migrate from',
  })
  .option('mongoUrl', {
    type: 'string',
    describe: 'MongoDB connection string (required when --from mongo)',
  })
  .option('dataDir', {
    type: 'string',
    describe: 'NeDB data directory (defaults to ./.data/db) when --from fs',
  })
  .strict()
  .parseSync();

const buildSource = async (): Promise<MigrationSource> => {
  if (argv.from === 'mongo') {
    if (!argv.mongoUrl) {
      throw new Error('--mongoUrl is required when --from mongo');
    }
    return createMongoSource(argv.mongoUrl);
  }
  return createFileSource(argv.dataDir);
};

const main = async (): Promise<void> => {
  // The destination is the active sink, so it must be postgres. Reading the
  // source is independent (its own driver), so the two never clash.
  const db = getDatabase();
  if (db.type !== 'postgres') {
    throw new Error(
      `The active sink is "${db.type}", but this migration writes to postgres. ` +
        'Enable the postgres sink (with its connectionString or ' +
        'GIT_PROXY_POSTGRES_CONNECTION_STRING) before running this.',
    );
  }

  const source = await buildSource();
  try {
    const summary = await migrate(source, postgres, { log: (message) => console.log(message) });
    console.log('Migration complete:');
    console.log(`  users:  ${summary.users.imported} imported, ${summary.users.skipped} skipped`);
    console.log(`  repos:  ${summary.repos.imported} imported, ${summary.repos.skipped} skipped`);
    console.log(`  pushes: ${summary.pushes.imported} imported`);
  } finally {
    await source.close();
  }
};

main().catch((err) => {
  console.error(`Migration failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
