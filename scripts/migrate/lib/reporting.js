const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function generateReports(reportsDir, report, timestamp) {
  console.log('\n=== REPORT GENERATION ===');

  const yamlPath = path.join(reportsDir, `report-${timestamp}.yaml`);
  fs.writeFileSync(
    yamlPath,
    yaml.dump(report, { indent: 2 })
  );
  console.log(`SUCCESS YAML report: ${yamlPath}`);

  if (report.changes && report.changes.length > 0) {
    const csvPath = path.join(reportsDir, `report-${timestamp}.csv`);
    const csvHeader = 'RepoID,RepoName,OldURL,NewURL,Status\n';
    const csvRows = report.changes
      .map(
        (change) =>
          `"${change.repoId}","${change.repoName}","${change.oldUrl}","${change.newUrl}","${change.status}"`
      )
      .join('\n');
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`SUCCESS CSV report: ${csvPath}`);
  }
}

module.exports = { generateReports };
