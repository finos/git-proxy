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

const { MongoClient } = require('mongodb');

function buildUrlNormalizationReport(repos) {
  const report = {
    totalRepos: repos.length,
    reposNeedingUpdate: 0,
    reposAlreadyFixed: 0,
    changes: [],
  };

  for (const repo of repos) {
    const currentUrl = (repo.url || '').trim();
    const needsUpdate = !currentUrl.endsWith('.git');

    if (needsUpdate) {
      report.reposNeedingUpdate++;
      const newUrl = `${currentUrl}.git`;
      report.changes.push({
        repoId: repo._id?.toString?.() ?? String(repo._id ?? ''),
        repoName: repo.name,
        oldUrl: currentUrl,
        newUrl: newUrl,
        status: 'pending',
      });
    } else {
      report.reposAlreadyFixed++;
    }
  }

  return report;
}

async function analyzeRepos(mongoUri, dbName) {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const reposCollection = db.collection('repos');

    console.log('\n=== ANALYSIS PHASE ===');
    const allRepos = await reposCollection.find({}).toArray();

    console.log(`Total repos in database: ${allRepos.length}`);
    const report = buildUrlNormalizationReport(allRepos);

    for (const repo of allRepos) {
      const currentUrl = (repo.url || '').trim();
      const needsUpdate = !currentUrl.endsWith('.git');
      if (needsUpdate) {
        const newUrl = `${currentUrl}.git`;
        console.log(`  WARNING ${repo.name}: ${currentUrl} -> ${newUrl}`);
      } else {
        console.log(`  OK ${repo.name}: already has .git`);
      }
    }

    console.log(`\nRepos needing update: ${report.reposNeedingUpdate}`);
    console.log(`Repos already fixed: ${report.reposAlreadyFixed}`);

    return { allRepos, report };
  } finally {
    await client.close();
  }
}

module.exports = { analyzeRepos, buildUrlNormalizationReport };
