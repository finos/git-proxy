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
 * Migration: Audit and (optionally) fix users.email for v2.0.0 compatibility
 *
 * DRY RUN (default):
 *   npm run migrate:users
 *   # or: node scripts/migrate/migrate-users.js
 *
 * APPLY (requires CSV mapping username,email):
 *   npm run migrate:users -- --apply --csv ./mappings.csv
 *
 * Optional: --dbType mongo|fs (default mongo), DB_TYPE env
 */

const path = require('path');

const config = require('./lib/config');
const { generateReports } = require('./lib/reporting');
const { getArgValue } = require('./lib/args');
const { createDatastoreFromArgv } = require('./lib/datastore');
const { analyzeUsersWithDatastore } = require('./lib/analyze-users');
const { analyzeAclWithDatastore } = require('./lib/analyze-acl');
const { readUsernameEmailCsv } = require('./lib/csv');
const { applyUserEmailsWithDatastore } = require('./lib/apply-user-emails');

const argv = process.argv.slice(2);

const args = {
  apply: argv.includes('--apply'),
  csvPath: getArgValue('--csv', argv),
};

config.ensureReportsDir();

function printDryRunNextSteps() {
  console.log('\n=== DRY RUN MODE (default) ===');
  console.log('No changes applied.');
  console.log('\nNext steps:');
  console.log('  1. Create users backup (recommended):');
  console.log('     node scripts/migrate/backup-users.js');
  console.log('  2. Prepare CSV mapping: username,email');
  console.log('  3. Apply changes:');
  console.log('     node scripts/migrate/migrate-users.js --apply --csv mappings.csv');
}

function buildUsersMigrationReport({ mode, usersReport, aclReport, csv, apply }) {
  return {
    mode,
    users: usersReport,
    acl: aclReport,
    apply: apply ?? null,
    csv: csv ?? null,
  };
}

async function runEmailApplyFromCsv(datastore, csvPath) {
  const absCsvPath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  const { mapping, errors, rows } = readUsernameEmailCsv(absCsvPath);
  const csv = { path: absCsvPath, rowCount: rows.length, errors };

  if (errors.length > 0) {
    console.error(`CSV validation errors: ${errors.length}`);
    return {
      csv,
      apply: { ok: false, reason: 'csv-errors', changes: [] },
    };
  }

  const apply = await applyUserEmailsWithDatastore(datastore, mapping, {
    dryRun: false,
  });
  return { csv, apply };
}

function computeExitCode(report) {
  const blockingUsers = report.users?.blockingIssueCount ?? 0;
  const aclOrphans = report.acl?.orphanCount ?? 0;
  const applyOk = report.apply ? report.apply.ok : true;
  const applyConflicts =
    report.apply && Array.isArray(report.apply.conflicts) ? report.apply.conflicts.length : 0;
  const csvErrors = report.csv && Array.isArray(report.csv.errors) ? report.csv.errors.length : 0;

  const shouldFail =
    blockingUsers > 0 || aclOrphans > 0 || !applyOk || applyConflicts > 0 || csvErrors > 0;

  return shouldFail ? 1 : 0;
}

function printMigrationSummary(report, applyMode) {
  const blockingUsers = report.users?.blockingIssueCount ?? 0;
  const aclOrphans = report.acl?.orphanCount ?? 0;
  const applyOk = report.apply ? report.apply.ok : true;
  const applyConflicts =
    report.apply && Array.isArray(report.apply.conflicts) ? report.apply.conflicts.length : 0;
  const csvErrors = report.csv && Array.isArray(report.csv.errors) ? report.csv.errors.length : 0;

  console.log('\n=== SUMMARY ===');
  console.log(`Mode: ${report.mode}`);
  console.log(`Users (blocking): ${blockingUsers}`);
  console.log(`ACL orphans: ${aclOrphans}`);
  if (applyMode) {
    console.log(`CSV errors: ${csvErrors}`);
    console.log(`Apply ok: ${applyOk}`);
    console.log(`Apply conflicts: ${applyConflicts}`);
  }
}

function persistReportAndPrintSummary(reportsDir, report, applyMode) {
  const timestamp = Date.now();
  generateReports(reportsDir, report, timestamp);
  printMigrationSummary(report, applyMode);
  return computeExitCode(report);
}

async function main() {
  let ds;
  try {
    ds = await createDatastoreFromArgv(argv);
    const { report: usersReport } = await analyzeUsersWithDatastore(ds);
    const { report: aclReport } = await analyzeAclWithDatastore(ds);

    let csv = null;
    let apply = null;

    if (!args.apply) {
      printDryRunNextSteps();
    } else {
      console.log('\n=== APPLY MODE ===');
      if (!args.csvPath) {
        throw new Error('--apply requires --csv <path>');
      }
      ({ csv, apply } = await runEmailApplyFromCsv(ds, args.csvPath));
    }

    const report = buildUsersMigrationReport({
      mode: args.apply ? 'apply' : 'dry-run',
      usersReport,
      aclReport,
      csv,
      apply,
    });

    const exitCode = persistReportAndPrintSummary(config.reportsDir, report, args.apply);
    process.exit(exitCode);
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
