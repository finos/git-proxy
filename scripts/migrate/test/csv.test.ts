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

import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readUsernameEmailCsv } = require('../lib/csv.js');

function writeTempCsv(contents: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-proxy-migrate-'));
  const filePath = path.join(dir, 'mappings.csv');
  fs.writeFileSync(filePath, contents, 'utf8');
  return filePath;
}

describe('scripts/migrate/lib/csv.js', () => {
  test('throws on empty CSV', () => {
    const p = writeTempCsv('\n\n');
    expect(() => readUsernameEmailCsv(p)).toThrow(/CSV is empty/);
  });

  test('throws on missing username,email header', () => {
    const p = writeTempCsv('user,email\nalice,a@b.com\n');
    expect(() => readUsernameEmailCsv(p)).toThrow(/CSV header must include: username,email/);
  });

  test('normalizes username/email and returns mapping', () => {
    const p = writeTempCsv('username,email\n Alice , ALICE@EXAMPLE.COM \n');
    const { errors, mapping, rows } = readUsernameEmailCsv(p);
    expect(errors).toEqual([]);
    expect(mapping.get('alice')).toBe('alice@example.com');
    expect(rows[0].usernameRaw).toBe('Alice');
    expect(rows[0].emailRaw).toBe('ALICE@EXAMPLE.COM');
    expect(rows[0].username).toBe('alice');
    expect(rows[0].email).toBe('alice@example.com');
  });

  test('reports missing username', () => {
    const p = writeTempCsv('username,email\n, a@b.com\n');
    const { errors, mapping } = readUsernameEmailCsv(p);
    expect(mapping.size).toBe(0);
    expect(errors[0]).toMatchObject({ code: 'missing-username', line: 2 });
  });

  test('reports missing email', () => {
    const p = writeTempCsv('username,email\nbob,\n');
    const { errors, mapping } = readUsernameEmailCsv(p);
    expect(mapping.size).toBe(0);
    expect(errors[0]).toMatchObject({ code: 'missing-email', line: 2, username: 'bob' });
  });

  test('reports invalid email format', () => {
    const p = writeTempCsv('username,email\nbob,not-an-email\n');
    const { errors, mapping } = readUsernameEmailCsv(p);
    expect(mapping.size).toBe(0);
    expect(errors[0]).toMatchObject({ code: 'invalid-email-format', line: 2, username: 'bob' });
  });

  test('duplicate username with different emails produces error and keeps first', () => {
    const p = writeTempCsv('username,email\nbob,b1@ex.com\nbob,b2@ex.com\n');
    const { errors, mapping } = readUsernameEmailCsv(p);
    expect(mapping.get('bob')).toBe('b1@ex.com');
    expect(errors.some((e: any) => e.code === 'duplicate-username')).toBe(true);
  });

  test('duplicate username with same email is allowed', () => {
    const p = writeTempCsv('username,email\nbob,b@ex.com\nbob,b@ex.com\n');
    const { errors, mapping } = readUsernameEmailCsv(p);
    expect(errors).toEqual([]);
    expect(mapping.get('bob')).toBe('b@ex.com');
  });
});
