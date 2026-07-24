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

import fs from 'fs';
import os from 'os';
import path from 'path';

import Datastore from '@seald-io/nedb';
import { describe, it, expect, afterAll } from 'vitest';

import { createFileSource } from '../../../src/db/postgres/migrateFileSource';

const tmpDirs: string[] = [];

const makeDataDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-fs-src-'));
  tmpDirs.push(dir);
  return dir;
};

const seed = (dir: string, file: string, doc: Record<string, unknown>) =>
  new Datastore({ filename: path.join(dir, file), autoload: true }).insertAsync(doc);

afterAll(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe('PostgreSQL - migrate file source', () => {
  it('reads users, repos and pushes from the NeDB datastores', async () => {
    const dir = makeDataDir();
    await seed(dir, 'users.db', {
      username: 'alice',
      email: 'alice@x.com',
      gitAccount: 'a',
      admin: true,
    });
    await seed(dir, 'repos.db', {
      project: 'p',
      name: 'n',
      url: 'https://x/n.git',
      users: { canPush: [], canAuthorise: [] },
    });
    await seed(dir, 'pushes.db', { id: 'push-1', type: 'push' });

    const source = createFileSource(dir);

    expect((await source.getUsers()).map((u) => u.username)).toEqual(['alice']);
    expect((await source.getRepos()).map((r) => r.url)).toEqual(['https://x/n.git']);
    expect((await source.getPushes()).map((p) => p.id)).toEqual(['push-1']);

    await source.close();
  });

  it('returns empty arrays when the datastores have no records', async () => {
    const source = createFileSource(makeDataDir());

    expect(await source.getUsers()).toEqual([]);
    expect(await source.getRepos()).toEqual([]);
    expect(await source.getPushes()).toEqual([]);
  });
});
