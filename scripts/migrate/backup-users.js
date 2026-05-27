#!/usr/bin/env node

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
 * Backup: Create backup of users before email migration
 *
 * BACKUP ONLY
 *
 * Usage:
 *   node scripts/migrate/backup-users.js
 */

const { MongoClient } = require('mongodb');

const config = require('./lib/config');
const { generateReports } = require('./lib/reporting');
const { createBackup } = require('./lib/common');

config.ensureReportsDir();

async function main() {
  const client = new MongoClient(config.mongoUri);

  try {
    await client.connect();
    const db = client.db(config.dbName);
    const usersCollection = db.collection('users');

    console.log('\n=== BACKUP USERS PHASE ===');
    const users = await usersCollection.find({}).project({ password: 0 }).toArray();
    console.log(`Total users in database: ${users.length}`);

    const backupPath = createBackup(config.reportsDir, 'backup-users', users);
    console.log(`SUCCESS Backup created: ${backupPath}`);

    const timestamp = Date.now();
    const report = { mode: 'backup-users', totalUsers: users.length };
    generateReports(config.reportsDir, report, timestamp);

    process.exit(0);
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
}

main();
