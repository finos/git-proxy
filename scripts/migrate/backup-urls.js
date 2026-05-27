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
 * Backup: Create backup of repos without .git suffix before migration
 *
 * BACKUP ONLY
 *
 * Usage:
 *   npm run backup:urls
 *   # or: node scripts/migrate/backup-urls.js
 */

const config = require('./lib/config');
const { analyzeRepos } = require('./lib/analyze-urls');
const { generateReports } = require('./lib/reporting');
const { createBackup } = require('./lib/common');

config.ensureReportsDir();

async function main() {
  try {
    const { allRepos, report } = await analyzeRepos(config.mongoUri, config.dbName);

    if (report.reposNeedingUpdate === 0) {
      console.log('\n=== BACKUP PHASE ===');
      console.log('No repos need migration - backup not necessary');
      process.exit(0);
    }

    console.log('\n=== BACKUP PHASE ===');
    const backupData = allRepos.filter((repo) => !repo.url.endsWith('.git'));
    const backupPath = createBackup(config.reportsDir, 'backup-urls', backupData);
    console.log(`SUCCESS Backup created: ${backupPath}`);
    console.log(`  (${report.reposNeedingUpdate} repos without .git)`);
    console.log('\nBackup completed. Ready to apply migration:');
    console.log('  node scripts/migrate/migrate-urls.js --apply');

    const timestamp = Date.now();
    report.mode = 'backup-only';
    generateReports(config.reportsDir, report, timestamp);

    process.exit(0);
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  }
}

main();
