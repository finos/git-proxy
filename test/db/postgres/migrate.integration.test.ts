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

import * as postgres from '../../../src/db/postgres';
import { migrate } from '../../../src/db/postgres/migrate';
import { createFileSource } from '../../../src/db/postgres/migrateFileSource';
import { gitAccountToScmIdentities } from '../../../src/db/migrations/gitAccountToScmIdentities';

const shouldRunPostgresTests = process.env.RUN_POSTGRES_TESTS === 'true';

const tmpDirs: string[] = [];

const seedFsBackend = async (scmIdentities?: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-migrate-'));
  tmpDirs.push(dir);
  await new Datastore({ filename: path.join(dir, 'users.db'), autoload: true }).insertAsync({
    username: 'mig-alice',
    email: 'mig-alice@x.com',
    password: 'hash',
    ...(scmIdentities ? { scmIdentities } : { gitAccount: 'mig-alice-git' }),
    mustChangePassword: true,
    admin: false,
  });
  await new Datastore({ filename: path.join(dir, 'repos.db'), autoload: true }).insertAsync({
    project: 'mig',
    name: 'mig-repo',
    url: 'https://example.com/mig/repo.git',
    users: { canPush: ['mig-alice'], canAuthorise: [] },
  });
  await new Datastore({ filename: path.join(dir, 'pushes.db'), autoload: true }).insertAsync({
    id: 'mig-push-1',
    type: 'push',
    timestamp: 1700000000000,
  });
  return dir;
};

afterAll(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe.runIf(shouldRunPostgresTests)('PostgreSQL Data Migration Integration Tests', () => {
  it('migrates users, repos and pushes from an fs backend into postgres', async () => {
    const source = createFileSource(await seedFsBackend());

    const summary = await migrate(source, postgres);
    await source.close();

    expect(summary).toEqual({
      users: { imported: 1, skipped: 0 },
      repos: { imported: 1, skipped: 0 },
      pushes: { imported: 1 },
    });

    const user = await postgres.findUser('mig-alice');
    expect(user?.email).toBe('mig-alice@x.com');
    expect(user?.mustChangePassword).toBe(true);
    expect(user).toHaveProperty('gitAccount', 'mig-alice-git');
    await gitAccountToScmIdentities.up(postgres);
    expect((await postgres.findUserByScmIdentity('github', 'mig-alice-git'))?.username).toBe(
      'mig-alice',
    );
    expect(user?._id).toMatch(/^[0-9a-f-]{36}$/i); // freshly assigned UUID

    const repo = await postgres.getRepoByUrl('https://example.com/mig/repo.git');
    expect(repo?.users.canPush).toEqual(['mig-alice']);

    const push = await postgres.getPush('mig-push-1');
    expect(push?.id).toBe('mig-push-1');
  });

  it('preserves modern provider identities when copying from fs', async () => {
    const scmIdentities = { github: 'alice', gitlab: 'alice-lab' };
    const source = createFileSource(await seedFsBackend(scmIdentities));
    try {
      await migrate(source, postgres);
      expect((await postgres.findUser('mig-alice'))?.scmIdentities).toEqual(scmIdentities);
      expect((await postgres.findUserByScmIdentity('gitlab', 'Alice-Lab'))?.username).toBe(
        'mig-alice',
      );
    } finally {
      await source.close();
    }
  });

  it('skips already-imported users and repos on a second run', async () => {
    const source = createFileSource(await seedFsBackend());

    await migrate(source, postgres);
    const second = await migrate(source, postgres);
    await source.close();

    expect(second.users).toEqual({ imported: 0, skipped: 1 });
    expect(second.repos).toEqual({ imported: 0, skipped: 1 });
    // Pushes are upserted by id, so re-running still "imports" (writes) them.
    expect(second.pushes.imported).toBe(1);
  });
});
