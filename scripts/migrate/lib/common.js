const { MongoClient, ObjectId } = require('mongodb');

async function updateRepoUrl(mongoUri, dbName, repoId, newUrl) {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const reposCollection = db.collection('repos');

    const result = await reposCollection.updateOne(
      { _id: new ObjectId(repoId) },
      { $set: { url: newUrl } }
    );

    return result.modifiedCount === 1;
  } finally {
    await client.close();
  }
}

async function countReposWithoutGit(mongoUri, dbName) {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const reposCollection = db.collection('repos');

    return await reposCollection.countDocuments({
      url: { $not: /\.git$/ },
    });
  } finally {
    await client.close();
  }
}

function createBackup(reportsDir, allRepos) {
  const fs = require('fs');
  const path = require('path');

  const backupPath = path.join(reportsDir, `backup-${Date.now()}.json`);
  const backupData = allRepos.filter((repo) => !repo.url.endsWith('.git'));
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

  return backupPath;
}

module.exports = {
  updateRepoUrl,
  countReposWithoutGit,
  createBackup,
};
