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

import { describe, it, expect, vi } from 'vitest';

import { migrate, MigrationDestination, MigrationSource } from '../../../src/db/postgres/migrate';
import { Repo, User } from '../../../src/db/types';

const user = (username: string, email: string): User =>
  new User(username, 'hash', `${username}-git`, email, false);

const repo = (url: string): Repo => new Repo('proj', `name-${url}`, url);

const makeSource = (over: Partial<MigrationSource> = {}): MigrationSource => ({
  getUsers: vi.fn().mockResolvedValue([]),
  getRepos: vi.fn().mockResolvedValue([]),
  getPushBatches: vi.fn(async function* () {}),
  close: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const makeDestination = (over: Partial<MigrationDestination> = {}): MigrationDestination => ({
  findUser: vi.fn().mockResolvedValue(null),
  findUserByEmail: vi.fn().mockResolvedValue(null),
  createUser: vi.fn().mockResolvedValue(undefined),
  getRepoByUrl: vi.fn().mockResolvedValue(null),
  createRepo: vi.fn().mockResolvedValue(undefined),
  writeAudit: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe('PostgreSQL - migrate', () => {
  it('imports users, repos and pushes into an empty destination', async () => {
    const source = makeSource({
      getUsers: vi.fn().mockResolvedValue([user('alice', 'alice@x.com'), user('bob', 'bob@x.com')]),
      getRepos: vi.fn().mockResolvedValue([repo('https://x/a.git')]),
      getPushBatches: vi.fn(async function* () {
        yield [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] as never;
      }),
    });
    const destination = makeDestination();

    const summary = await migrate(source, destination as never);

    expect(summary).toEqual({
      users: { imported: 2, skipped: 0 },
      repos: { imported: 1, skipped: 0 },
      pushes: { imported: 3 },
    });
    expect(destination.createUser).toHaveBeenCalledTimes(2);
    expect(destination.createRepo).toHaveBeenCalledTimes(1);
    expect(destination.writeAudit).toHaveBeenCalledTimes(3);
  });

  it('defaults missing email and gitAccount on legacy users', async () => {
    const legacy = user('ad-user', 'ignored');
    delete (legacy as Partial<User>).email;
    delete (legacy as Partial<User>).gitAccount;
    const source = makeSource({ getUsers: vi.fn().mockResolvedValue([legacy]) });
    const destination = makeDestination();

    const summary = await migrate(source, destination as never);

    expect(summary.users).toEqual({ imported: 1, skipped: 0 });
    expect(destination.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'ad-user', email: '', gitAccount: '' }),
    );
    // No email to dedupe on, so the email lookup is skipped entirely.
    expect(destination.findUserByEmail).not.toHaveBeenCalled();
  });

  it('skips a user that already exists by username', async () => {
    const source = makeSource({ getUsers: vi.fn().mockResolvedValue([user('alice', 'a@x.com')]) });
    const destination = makeDestination({
      findUser: vi.fn().mockResolvedValue(user('alice', 'a@x.com')),
    });

    const summary = await migrate(source, destination as never);

    expect(summary.users).toEqual({ imported: 0, skipped: 1 });
    expect(destination.createUser).not.toHaveBeenCalled();
  });

  it('skips a user that already exists by email when the username differs', async () => {
    const source = makeSource({ getUsers: vi.fn().mockResolvedValue([user('alice', 'a@x.com')]) });
    const destination = makeDestination({
      findUser: vi.fn().mockResolvedValue(null),
      findUserByEmail: vi.fn().mockResolvedValue(user('other', 'a@x.com')),
    });

    const summary = await migrate(source, destination as never);

    expect(summary.users).toEqual({ imported: 0, skipped: 1 });
    expect(destination.createUser).not.toHaveBeenCalled();
  });

  it('skips a repo that already exists by URL', async () => {
    const source = makeSource({ getRepos: vi.fn().mockResolvedValue([repo('https://x/a.git')]) });
    const destination = makeDestination({
      getRepoByUrl: vi.fn().mockResolvedValue(repo('https://x/a.git')),
    });

    const summary = await migrate(source, destination as never);

    expect(summary.repos).toEqual({ imported: 0, skipped: 1 });
    expect(destination.createRepo).not.toHaveBeenCalled();
  });

  it('does not look up by email when the source user has none', async () => {
    const noEmail = new User('svc', 'hash', 'svc-git', '', false);
    const source = makeSource({ getUsers: vi.fn().mockResolvedValue([noEmail]) });
    const destination = makeDestination();

    await migrate(source, destination as never);

    expect(destination.findUserByEmail).not.toHaveBeenCalled();
    expect(destination.createUser).toHaveBeenCalledTimes(1);
  });

  it('reports progress through the supplied logger', async () => {
    const source = makeSource({ getUsers: vi.fn().mockResolvedValue([user('a', 'a@x.com')]) });
    const log = vi.fn();

    await migrate(source, makeDestination() as never, { log });

    expect(log).toHaveBeenCalledWith('Migrating 1 user(s)...');
    expect(log).toHaveBeenCalledWith('Migrating 0 repo(s)...');
    expect(log).toHaveBeenCalledWith('Migrating pushes...');
  });

  it('writes pushes batch by batch and counts across batches', async () => {
    const source = makeSource({
      getPushBatches: vi.fn(async function* () {
        yield [{ id: 'p1' }, { id: 'p2' }] as never;
        yield [{ id: 'p3' }] as never;
      }),
    });
    const destination = makeDestination();

    const summary = await migrate(source, destination as never);

    expect(summary.pushes).toEqual({ imported: 3 });
    expect(destination.writeAudit).toHaveBeenCalledTimes(3);
  });

  it('passes user passwords through unchanged (already hashed at the source)', async () => {
    // The destination is the raw postgres adapter, whose createUser stores the
    // supplied value verbatim; hashing lives in the service-level wrapper in
    // src/db/index.ts. Source passwords are bcrypt hashes and must survive
    // the copy byte for byte, or every migrated login would break.
    const hashed = '$2a$10$abcdefghijklmnopqrstuv';
    const source = makeSource({
      getUsers: vi
        .fn()
        .mockResolvedValue([Object.assign(user('alice', 'alice@x.com'), { password: hashed })]),
    });
    const destination = makeDestination();

    await migrate(source, destination as never);

    expect(destination.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ password: hashed }),
    );
  });

  it('passes repo permissions through createRepo without separate role calls', async () => {
    // The adapter's createRepo persists the whole users permission map, so the
    // migration needs no addUserCanPush / addUserCanAuthorise follow-ups.
    const seeded = Object.assign(repo('https://x/a.git'), {
      users: { canPush: ['alice'], canAuthorise: ['bob'] },
    });
    const source = makeSource({ getRepos: vi.fn().mockResolvedValue([seeded]) });
    const destination = makeDestination();

    await migrate(source, destination as never);

    expect(destination.createRepo).toHaveBeenCalledWith(
      expect.objectContaining({ users: { canPush: ['alice'], canAuthorise: ['bob'] } }),
    );
  });
});
