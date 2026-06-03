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
const { MongoClient, ObjectId } = require('mongodb');
const Datastore = require('@seald-io/nedb');

const { parseMigrationArgs } = require('./args');
const { normalizeEmail } = require('./email');
const { normalizeUsername } = require('./csv');
const baseConfig = require('./config');

const DEFAULT_USERS_DB_PATH = './.data/db/users.db';
const DEFAULT_REPOS_DB_PATH = './.data/db/repos.db';

function omitPassword(user) {
  const { password, ...rest } = user;
  return rest;
}

function nedbFind(db, query = {}) {
  return new Promise((resolve, reject) => {
    db.find(query, (err, docs) => {
      if (err) reject(err);
      else resolve(docs);
    });
  });
}

function nedbFindOne(db, query) {
  return new Promise((resolve, reject) => {
    db.findOne(query, (err, doc) => {
      if (err) reject(err);
      else resolve(doc ?? null);
    });
  });
}

function nedbUpdate(db, query, update, options = { multi: false, upsert: false }) {
  return new Promise((resolve, reject) => {
    db.update(query, update, options, (err, numReplaced) => {
      if (err) reject(err);
      else resolve(numReplaced);
    });
  });
}

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function createMongoDatastore({ mongoUri, dbName }) {
  if (!mongoUri) {
    throw new Error('mongoUri is required for mongo datastore');
  }
  if (!dbName) {
    throw new Error('dbName is required for mongo datastore');
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const usersCollection = db.collection('users');
  const reposCollection = db.collection('repos');

  return {
    dbType: 'mongo',
    async listUsers() {
      return usersCollection.find({}).project({ password: 0 }).toArray();
    },
    async listRepos() {
      return reposCollection.find({}).toArray();
    },
    async updateUserEmailByUsername(username, email) {
      const key = normalizeUsername(username);
      const nextEmail = normalizeEmail(email);
      const user = await usersCollection.findOne({ username: key });
      if (!user) {
        return { ok: false, reason: 'user-not-found' };
      }
      const id = user._id?.toString?.() ?? String(user._id ?? '');
      const res = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { email: nextEmail } },
      );
      return { ok: true, modified: res.modifiedCount === 1 };
    },
    async updateRepoUrlById(repoId, newUrl) {
      const res = await reposCollection.updateOne(
        { _id: new ObjectId(repoId) },
        { $set: { url: newUrl } },
      );
      return res.modifiedCount === 1;
    },
    async countReposWithoutGitSuffix() {
      return reposCollection.countDocuments({
        url: { $not: /\.git$/ },
      });
    },
    async close() {
      await client.close().catch(() => {});
    },
  };
}

async function createFsDatastore({ usersDbPath, reposDbPath }) {
  const usersPath = path.resolve(process.cwd(), usersDbPath || DEFAULT_USERS_DB_PATH);
  const reposPath = path.resolve(process.cwd(), reposDbPath || DEFAULT_REPOS_DB_PATH);

  ensureParentDir(usersPath);
  ensureParentDir(reposPath);

  const usersDb = new Datastore({ filename: usersPath, autoload: true });
  const reposDb = new Datastore({ filename: reposPath, autoload: true });

  await Promise.all([
    new Promise((resolve, reject) => {
      usersDb.ensureIndex({ fieldName: 'username', unique: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
    new Promise((resolve, reject) => {
      reposDb.ensureIndex({ fieldName: 'url', unique: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
  ]);

  return {
    dbType: 'fs',
    async listUsers() {
      const docs = await nedbFind(usersDb, {});
      return docs.map(omitPassword);
    },
    async listRepos() {
      return nedbFind(reposDb, {});
    },
    async updateUserEmailByUsername(username, email) {
      const key = normalizeUsername(username);
      const nextEmail = normalizeEmail(email);
      const existing = await nedbFindOne(usersDb, { username: key });
      if (!existing) {
        return { ok: false, reason: 'user-not-found' };
      }
      const merged = { ...existing, email: nextEmail };
      const numReplaced = await nedbUpdate(usersDb, { username: key }, merged, {
        multi: false,
        upsert: false,
      });
      return { ok: true, modified: numReplaced >= 1 };
    },
    async updateRepoUrlById(repoId, newUrl) {
      const existing = await nedbFindOne(reposDb, { _id: repoId });
      if (!existing) {
        return false;
      }
      const merged = { ...existing, url: newUrl };
      const numReplaced = await nedbUpdate(reposDb, { _id: repoId }, merged, {
        multi: false,
        upsert: false,
      });
      return numReplaced >= 1;
    },
    async countReposWithoutGitSuffix() {
      const repos = await nedbFind(reposDb, {});
      return repos.filter((r) => {
        const url = (r.url ?? '').toString().replace(/\/+$/, '');
        return url && !url.endsWith('.git');
      }).length;
    },
    async close() {
      // neDB file handles are managed per process; no explicit close required
    },
  };
}

/**
 * Create a migration datastore for the given options.
 * Caller must call `close()` when finished (use try/finally in scripts).
 *
 * @param {{ dbType: string, mongoUri?: string|null, dbName?: string|null, usersDbPath?: string|null, reposDbPath?: string|null }} options
 */
async function createDatastore(options) {
  if (options.dbType === 'fs') {
    return createFsDatastore({
      usersDbPath: options.usersDbPath,
      reposDbPath: options.reposDbPath,
    });
  }

  if (options.dbType === 'mongo') {
    return createMongoDatastore({
      mongoUri: options.mongoUri,
      dbName: options.dbName,
    });
  }

  throw new Error(`Unsupported dbType: ${options.dbType}`);
}

/**
 * Parse CLI/env and create a datastore (convenience for entrypoint scripts).
 *
 * @param {string[]} [argv]
 * @param {NodeJS.ProcessEnv} [env]
 * @param {object} [defaults]
 */
async function createDatastoreFromArgv(
  argv = process.argv.slice(2),
  env = process.env,
  defaults = {},
) {
  const parsed = parseMigrationArgs(argv, env, {
    mongoUri: baseConfig.mongoUri,
    dbName: baseConfig.dbName,
    ...defaults,
  });
  return createDatastore(parsed);
}

module.exports = {
  createDatastore,
  createDatastoreFromArgv,
};
