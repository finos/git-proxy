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
 * Migration: Repo URL normalization — append .git to repos.url where missing
 *
 * DRY RUN (default):
 *   npm run migrate:urls
 *   # or: node scripts/migrate/migrate-urls.js
 *
 * APPLY:
 *   npm run migrate:urls -- --apply
 *   # or: node scripts/migrate/migrate-urls.js --apply
 */

const config = require('./lib/config');
const { analyzeRepos } = require('./lib/analyze-urls');
const { generateReports } = require('./lib/reporting');
const { updateRepoUrl, countReposWithoutGit } = require('./lib/common');

const args = {
  apply: process.argv.includes('--apply'),
};

config.ensureReportsDir();

async function main() {
  try {
    const { report } = await analyzeRepos(config.mongoUri, config.dbName);
    const urlIssues =
      report.issueCount ?? (Array.isArray(report.issues) ? report.issues.length : 0);

    // === DRY RUN (default) or APPLY ===
    if (!args.apply) {
      console.log('\n=== DRY RUN MODE (default) ===');
      console.log('No changes applied.');
      if (report.reposNeedingUpdate > 0) {
        console.log(`\nNext steps:`);
        console.log(`  1. Create backup (recommended):`);
        console.log(`     node scripts/migrate/backup-urls.js`);
        console.log(`  2. Apply changes:`);
        console.log(`     node scripts/migrate/migrate-urls.js --apply`);
      }
      if (urlIssues > 0) {
        console.log(`\nWARNING URL issues detected (manual fix required): ${urlIssues}`);
      }
    } else {
      console.log('\n=== APPLY PHASE ===');
      let reposUpdated = 0;
      let errors = 0;

      for (const change of report.changes) {
        try {
          const success = await updateRepoUrl(
            config.mongoUri,
            config.dbName,
            change.repoId,
            change.newUrl,
          );

          if (success) {
            change.status = 'updated';
            reposUpdated++;
            console.log(`  SUCCESS Updated ${change.repoName}`);
          } else {
            change.status = 'no-change';
            console.log(`  WARNING No change for ${change.repoName}`);
          }
        } catch (error) {
          change.status = 'error';
          change.error = error.message;
          errors++;
          console.error(`  ERROR updating ${change.repoName}: ${error.message}`);
        }
      }

      console.log(`\nRepos updated: ${reposUpdated}`);
      console.log(`Errors: ${errors}`);

      // === VERIFY ===
      console.log('\n=== VERIFICATION PHASE ===');
      const remaining = await countReposWithoutGit(config.mongoUri, config.dbName);
      console.log(`Repos still without .git: ${remaining}`);

      if (remaining === 0) {
        console.log('SUCCESS Migration verified: all repos now have .git');
      } else {
        console.warn(`WARNING ${remaining} repos still need manual fixing`);
      }

      report.reposUpdated = reposUpdated;
      report.errors = errors;
    }

    // === REPORTING ===
    const timestamp = Date.now();
    generateReports(config.reportsDir, report, timestamp);

    // === SUMMARY ===
    console.log('\n=== SUMMARY ===');
    console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY RUN'}`);
    console.log(`Total repos: ${report.totalRepos}`);
    console.log(`Needing update: ${report.reposNeedingUpdate}`);
    console.log(`URL issues: ${urlIssues}`);
    console.log(`Updated: ${report.reposUpdated || 0}`);
    console.log(`Errors: ${report.errors || 0}`);

    const shouldFail = (report.errors || 0) > 0 || urlIssues > 0;
    process.exit(shouldFail ? 1 : 0);
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  }
}

main();
