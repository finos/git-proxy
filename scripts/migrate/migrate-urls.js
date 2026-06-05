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
 *
 * APPLY:
 *   npm run migrate:urls -- --apply
 *
 * Optional: --dbType mongo|fs (default mongo), DB_TYPE env
 */

const config = require('./lib/config');
const { createDatastoreFromArgv } = require('./lib/datastore');
const { analyzeReposWithDatastore } = require('./lib/analyze-urls');
const { generateReports } = require('./lib/reporting');

const argv = process.argv.slice(2);

const args = {
  apply: argv.includes('--apply'),
};

config.ensureReportsDir();

async function main() {
  let ds;

  try {
    ds = await createDatastoreFromArgv(argv);
    const { report } = await analyzeReposWithDatastore(ds);
    const urlIssues =
      report.issueCount ?? (Array.isArray(report.issues) ? report.issues.length : 0);

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
          const success = await ds.updateRepoUrlById(change.repoId, change.newUrl);

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

      console.log('\n=== VERIFICATION PHASE ===');
      const remaining = await ds.countReposWithoutGitSuffix();
      console.log(`Repos still without .git: ${remaining}`);

      if (remaining === 0) {
        console.log('SUCCESS Migration verified: all repos now have .git');
      } else {
        console.warn(
          `WARNING ${remaining} repo(s) still have url not ending with .git (includes blank/invalid URLs in issues — see URL issues above)`,
        );
      }

      report.reposUpdated = reposUpdated;
      report.errors = errors;
    }

    const timestamp = Date.now();
    generateReports(config.reportsDir, report, timestamp);

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
  } finally {
    if (ds) {
      await ds.close().catch(() => {});
    }
  }
}

main();
