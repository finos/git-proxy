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
const { normalizeEmail, isEmailFormatValid } = require('./email');

function parseCsvLine(line) {
  // Minimal CSV parsing: supports quoted fields with commas, no escaped quotes.
  // Good enough for username,email mapping.
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

function normalizeUsername(username) {
  return (username || '').trim().toLowerCase();
}

function readUsernameEmailCsv(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('CSV is empty');
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const uIdx = header.indexOf('username');
  const eIdx = header.indexOf('email');
  if (uIdx === -1 || eIdx === -1) {
    throw new Error('CSV header must include: username,email');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const username = cols[uIdx] ?? '';
    const email = cols[eIdx] ?? '';
    rows.push({
      line: i + 1,
      usernameRaw: username,
      emailRaw: email,
      username: normalizeUsername(username),
      email: normalizeEmail(email),
    });
  }

  const errors = [];
  const mapping = new Map(); // username -> email
  for (const row of rows) {
    if (!row.username) {
      errors.push({ line: row.line, code: 'missing-username', message: 'Username is blank' });
      continue;
    }
    if (!row.email) {
      errors.push({
        line: row.line,
        code: 'missing-email',
        message: 'Email is blank',
        username: row.username,
      });
      continue;
    }
    if (!isEmailFormatValid(row.email)) {
      errors.push({
        line: row.line,
        code: 'invalid-email-format',
        message: 'Email does not match basic format',
        username: row.username,
        email: row.email,
      });
      continue;
    }
    if (mapping.has(row.username) && mapping.get(row.username) !== row.email) {
      errors.push({
        line: row.line,
        code: 'duplicate-username',
        message: 'Username appears multiple times with different emails',
        username: row.username,
        email: row.email,
      });
      continue;
    }
    mapping.set(row.username, row.email);
  }

  return { rows, mapping, errors };
}

module.exports = {
  readUsernameEmailCsv,
  normalizeUsername,
  normalizeEmail,
  isEmailFormatValid,
};
