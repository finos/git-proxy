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

const { MongoClient, ObjectId } = require('mongodb');
const { normalizeEmail, normalizeUsername } = require('./csv');

function simulatePostApplyUniqueness(users, usernameToEmail) {
  const projected = new Map(); // userId -> normalizedEmail

  for (const u of users) {
    const id = u._id?.toString?.() ?? String(u._id ?? '');
    const username = normalizeUsername(u.username);
    const currentEmail = normalizeEmail(u.email);
    const nextEmail = normalizeEmail(usernameToEmail.get(username) ?? currentEmail);
    projected.set(id, nextEmail);
  }

  const byEmail = new Map(); // email -> [userId]
  for (const [userId, email] of projected.entries()) {
    if (!email) continue;
    const list = byEmail.get(email) ?? [];
    list.push(userId);
    byEmail.set(email, list);
  }

  const conflicts = [];
  for (const [email, ids] of byEmail.entries()) {
    if (ids.length > 1) conflicts.push({ normalizedEmail: email, userIds: ids });
  }

  return { conflicts, projected };
}

async function applyUserEmails(mongoUri, dbName, usernameToEmail, options = {}) {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    return await applyUserEmailsWithCollection(usersCollection, usernameToEmail, options);
  } finally {
    await client.close();
  }
}

async function applyUserEmailsWithCollection(usersCollection, usernameToEmail, options = {}) {
  const { dryRun = false } = options;

  const users = await usersCollection.find({}).project({ password: 0 }).toArray();

  const { conflicts } = simulatePostApplyUniqueness(users, usernameToEmail);
  if (conflicts.length > 0) {
    return {
      ok: false,
      reason: 'post-apply-duplicate',
      conflicts,
      changes: [],
    };
  }

  const changes = [];
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const userByUsername = new Map();
  for (const u of users) {
    userByUsername.set(normalizeUsername(u.username), u);
  }

  for (const [username, newEmail] of usernameToEmail.entries()) {
    const user = userByUsername.get(username);
    if (!user) {
      changes.push({ username, status: 'skipped', reason: 'user-not-found' });
      skipped++;
      continue;
    }

    const oldEmail = normalizeEmail(user.email);
    const nextEmail = normalizeEmail(newEmail);
    if (oldEmail === nextEmail) {
      changes.push({
        username,
        oldEmail,
        newEmail: nextEmail,
        status: 'skipped',
        reason: 'already-correct',
      });
      skipped++;
      continue;
    }

    if (dryRun) {
      changes.push({ username, oldEmail, newEmail: nextEmail, status: 'planned' });
      continue;
    }

    try {
      const id = user._id?.toString?.() ?? String(user._id ?? '');
      const res = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { email: nextEmail } },
      );
      if (res.modifiedCount === 1) {
        changes.push({ username, oldEmail, newEmail: nextEmail, status: 'updated' });
        updated++;
      } else {
        changes.push({
          username,
          oldEmail,
          newEmail: nextEmail,
          status: 'skipped',
          reason: 'no-change',
        });
        skipped++;
      }
    } catch (e) {
      changes.push({
        username,
        oldEmail,
        newEmail: nextEmail,
        status: 'error',
        error: e?.message ?? String(e),
      });
      errors++;
    }
  }

  return {
    ok: errors === 0,
    reason: errors === 0 ? 'applied' : 'errors',
    updated,
    skipped,
    errors,
    changes,
    conflicts: [],
  };
}

module.exports = {
  applyUserEmails,
  applyUserEmailsWithCollection,
  simulatePostApplyUniqueness,
};
