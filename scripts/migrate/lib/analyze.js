const { MongoClient } = require('mongodb');

async function analyzeRepos(mongoUri, dbName) {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const reposCollection = db.collection('repos');

    console.log('\n=== ANALYSIS PHASE ===');
    const allRepos = await reposCollection.find({}).toArray();

    console.log(`Total repos in database: ${allRepos.length}`);

    const report = {
      totalRepos: allRepos.length,
      reposNeedingUpdate: 0,
      reposAlreadyFixed: 0,
      changes: [],
    };

    for (const repo of allRepos) {
      const currentUrl = (repo.url || '').trim();
      const needsUpdate = !currentUrl.endsWith('.git');

      if (needsUpdate) {
        report.reposNeedingUpdate++;
        const newUrl = `${currentUrl}.git`;
        report.changes.push({
          repoId: repo._id.toString(),
          repoName: repo.name,
          oldUrl: currentUrl,
          newUrl: newUrl,
          status: 'pending',
        });
        console.log(`  WARNING ${repo.name}: ${currentUrl} -> ${newUrl}`);
      } else {
        report.reposAlreadyFixed++;
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

module.exports = { analyzeRepos };
