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

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function toCsvValue(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

function writeCsv(filePath, headerCols, rows) {
  const header = headerCols.join(',') + '\n';
  const body = rows.map((r) => r.map(toCsvValue).join(',')).join('\n');
  fs.writeFileSync(filePath, header + body);
}

function generateReports(reportsDir, report, timestamp) {
  console.log('\n=== REPORT GENERATION ===');

  const yamlPath = path.join(reportsDir, `report-${timestamp}.yaml`);
  fs.writeFileSync(yamlPath, yaml.dump(report, { indent: 2 }));
  console.log(`SUCCESS YAML report: ${yamlPath}`);

  // URL migration CSV (backward compatible)
  if (report.changes && report.changes.length > 0) {
    const csvPath = path.join(reportsDir, `report-${timestamp}.csv`);
    writeCsv(
      csvPath,
      ['RepoID', 'RepoName', 'OldURL', 'NewURL', 'Status'],
      report.changes.map((c) => [c.repoId, c.repoName, c.oldUrl, c.newUrl, c.status]),
    );
    console.log(`SUCCESS CSV report: ${csvPath}`);
  }

  // URL issues CSV (manual fix required)
  if (report.issues && Array.isArray(report.issues) && report.issues.length > 0) {
    const csvPath = path.join(reportsDir, `url-issues-${timestamp}.csv`);
    writeCsv(
      csvPath,
      ['RepoID', 'RepoName', 'RawURL', 'NormalizedURL', 'Reason', 'Scheme'],
      report.issues.map((i) => [
        i.repoId,
        i.repoName,
        i.rawUrl ?? '',
        i.normalizedUrl ?? '',
        i.reason ?? '',
        i.scheme ?? '',
      ]),
    );
    console.log(`SUCCESS CSV report: ${csvPath}`);
  }

  // Users email audit CSV
  if (report.users && Array.isArray(report.users.issues) && report.users.issues.length > 0) {
    const csvPath = path.join(reportsDir, `users-audit-${timestamp}.csv`);
    writeCsv(
      csvPath,
      ['UserID', 'Username', 'Status', 'Email', 'GitAccount', 'OIDCId', 'NormalizedEmail'],
      report.users.issues.map((u) => [
        u.userId,
        u.username,
        u.status,
        u.email,
        u.gitAccount,
        u.oidcId,
        u.normalizedEmail,
      ]),
    );
    console.log(`SUCCESS CSV report: ${csvPath}`);
  }

  // ACL orphans CSV
  if (report.acl && Array.isArray(report.acl.orphans) && report.acl.orphans.length > 0) {
    const csvPath = path.join(reportsDir, `acl-orphans-${timestamp}.csv`);
    writeCsv(
      csvPath,
      ['RepoID', 'RepoName', 'RepoURL', 'Field', 'OrphanUsername', 'NormalizedOrphan', 'Index'],
      report.acl.orphans.map((o) => [
        o.repoId,
        o.repoName,
        o.repoUrl,
        o.field,
        o.orphanUsername,
        o.normalizedOrphan,
        o.index,
      ]),
    );
    console.log(`SUCCESS CSV report: ${csvPath}`);
  }

  // Email changes CSV (apply)
  if (report.apply && Array.isArray(report.apply.changes) && report.apply.changes.length > 0) {
    const csvPath = path.join(reportsDir, `email-changes-${timestamp}.csv`);
    writeCsv(
      csvPath,
      ['Username', 'OldEmail', 'NewEmail', 'Status', 'Reason', 'Error'],
      report.apply.changes.map((c) => [
        c.username,
        c.oldEmail ?? '',
        c.newEmail ?? '',
        c.status,
        c.reason ?? '',
        c.error ?? '',
      ]),
    );
    console.log(`SUCCESS CSV report: ${csvPath}`);
  }
}

module.exports = { generateReports };
