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

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function isEmailFormatValid(email) {
  const v = normalizeEmail(email);
  // Basic sanity check only (not RFC exhaustive)
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}

async function analyzeUsers(mongoUri, dbName) {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    console.log('\n=== USERS EMAIL AUDIT PHASE ===');
    const users = await usersCollection.find({}).project({ password: 0 }).toArray();
    console.log(`Total users in database: ${users.length}`);

    const byEmail = new Map(); // normalizedEmail -> [{...userInfo}]
    const issues = [];

    for (const user of users) {
      const hasEmailField = Object.prototype.hasOwnProperty.call(user, 'email');
      const rawEmail = hasEmailField ? user.email : undefined;
      const email = normalizeEmail(rawEmail);

      let status = 'ok';
      if (!hasEmailField) status = 'missing';
      else if (!email) status = 'blank';
      else if (!isEmailFormatValid(email)) status = 'invalid-format';

      const info = {
        userId: user._id?.toString?.() ?? String(user._id ?? ''),
        username: user.username,
        gitAccount: user.gitAccount,
        oidcId: user.oidcId ?? null,
        email: rawEmail,
        normalizedEmail: email,
        status,
      };

      if (email) {
        const list = byEmail.get(email) ?? [];
        list.push(info);
        byEmail.set(email, list);
      }

      if (status !== 'ok') {
        issues.push(info);
      }
    }

    const duplicateGroups = [];
    for (const [email, list] of byEmail.entries()) {
      if (list.length > 1) {
        duplicateGroups.push({ normalizedEmail: email, users: list });
      }
    }

    // mark all users that are part of duplicates
    if (duplicateGroups.length > 0) {
      const duplicatedUserIds = new Set();
      for (const group of duplicateGroups) {
        for (const u of group.users) duplicatedUserIds.add(u.userId);
      }
      for (const item of issues) {
        if (duplicatedUserIds.has(item.userId)) item.status = 'duplicate';
      }
      // also add duplicate-only users that were previously ok
      for (const group of duplicateGroups) {
        for (const u of group.users) {
          if (u.status === 'ok') {
            issues.push({ ...u, status: 'duplicate' });
          }
        }
      }
    }

    const counts = {
      total: users.length,
      missing: issues.filter((x) => x.status === 'missing').length,
      blank: issues.filter((x) => x.status === 'blank').length,
      duplicate: issues.filter((x) => x.status === 'duplicate').length,
      invalidFormat: issues.filter((x) => x.status === 'invalid-format').length,
    };

    const report = {
      totalUsers: users.length,
      counts,
      duplicateGroups,
      issues,
      blockingIssueCount: counts.missing + counts.blank + counts.duplicate,
    };

    console.log(`Users with blocking issues: ${report.blockingIssueCount}`);

    return { users, report };
  } finally {
    await client.close();
  }
}

module.exports = {
  analyzeUsers,
  normalizeEmail,
  isEmailFormatValid,
};
