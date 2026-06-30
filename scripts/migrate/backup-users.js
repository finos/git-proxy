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
 * Outputs:
 * - backup-users-*.json (full users snapshot; passwords excluded)
 * - users-email-*.csv (username,email template for admin edits + later --apply --csv)
 *
 * Usage:
 *   npm run backup:users
 *   # or: node scripts/migrate/backup-users.js
 *   # optional: --dbType mongo|fs (default mongo)
 */

const fs = require('fs');
const path = require('path');

const config = require('./lib/config');
const { createDatastoreFromArgv } = require('./lib/datastore');
const { generateReports } = require('./lib/reporting');
const { createBackup } = require('./lib/common');

config.ensureReportsDir();

function toCsvValue(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

async function main() {
  const argv = process.argv.slice(2);
  let ds;

  try {
    ds = await createDatastoreFromArgv(argv);
    console.log('\n=== BACKUP USERS PHASE ===');
    const users = await ds.listUsers();
    console.log(`Total users in database: ${users.length}`);

    const backupPath = createBackup(config.reportsDir, 'backup-users', users);
    console.log(`SUCCESS Backup created: ${backupPath}`);

    const timestamp = Date.now();

    const emailCsvPath = path.join(config.reportsDir, `users-email-${timestamp}.csv`);
    const header = ['username', 'email'].join(',') + '\n';
    const rows = users
      .map((u) => [toCsvValue(u.username ?? ''), toCsvValue(u.email ?? '')].join(','))
      .join('\n');
    fs.writeFileSync(emailCsvPath, header + rows);
    console.log(`SUCCESS CSV template: ${emailCsvPath}`);

    const report = { mode: 'backup-users', totalUsers: users.length };
    generateReports(config.reportsDir, report, timestamp);

    process.exit(0);
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  } finally {
    if (ds) {
      await ds.close().catch(() => {});
    }
  }
}

main();
