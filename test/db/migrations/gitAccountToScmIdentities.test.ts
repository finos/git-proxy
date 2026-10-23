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

import { describe, it, expect, beforeEach } from 'vitest';
import * as fileSink from '../../../src/db/file';
import { db as usersDb } from '../../../src/db/file/users';
import { gitAccountToScmIdentities } from '../../../src/db/migrations/gitAccountToScmIdentities';
import { Sink } from '../../../src/db/types';

const sink = fileSink as unknown as Sink;

const insert = (doc: Record<string, unknown>) =>
  new Promise<void>((resolve, reject) =>
    usersDb.insert(doc, (err) => (err ? reject(err) : resolve())),
  );

const clear = () =>
  new Promise<void>((resolve, reject) =>
    usersDb.remove({}, { multi: true }, (err) => (err ? reject(err) : resolve())),
  );

describe('gitAccountToScmIdentities migration', () => {
  beforeEach(async () => {
    await clear();
    await insert({ username: 'linked', email: 'l@x', gitAccount: 'OctoCat', admin: false });
    await insert({ username: 'seed', email: 's@x', gitAccount: 'none', admin: true });
    await insert({ username: 'blank', email: 'b@x', gitAccount: '  ', admin: false });
    await insert({
      username: 'already',
      email: 'a@x',
      gitAccount: 'old-handle',
      scmIdentities: { gitlab: 'new-handle' },
      admin: false,
    });
    await insert({ username: 'fresh', email: 'f@x', scmIdentities: {}, admin: false });
  });

  it('carries a real gitAccount over as the github identity, lower-cased', async () => {
    await gitAccountToScmIdentities.up(sink);

    expect((await sink.findUser('linked'))?.scmIdentities).toEqual({ github: 'octocat' });
    expect(await sink.findUserByScmIdentity('github', 'OctoCat')).toMatchObject({
      username: 'linked',
    });
  });

  it('leaves the legacy field in place so the migration can be re-run', async () => {
    await gitAccountToScmIdentities.up(sink);
    await gitAccountToScmIdentities.up(sink);

    const user = (await sink.findUser('linked')) as unknown as { gitAccount?: string };
    expect(user.gitAccount).toBe('OctoCat');
  });

  it('skips the seed value, blank values, and users that already have identities', async () => {
    await gitAccountToScmIdentities.up(sink);

    expect((await sink.findUser('seed'))?.scmIdentities).toBeUndefined();
    expect((await sink.findUser('blank'))?.scmIdentities).toBeUndefined();
    expect((await sink.findUser('already'))?.scmIdentities).toEqual({ gitlab: 'new-handle' });
    expect((await sink.findUser('fresh'))?.scmIdentities).toEqual({});
  });

  it('links nobody when two legacy users carry the same handle', async () => {
    await insert({ username: 'dup-a', email: 'da@x', gitAccount: 'Shared', admin: false });
    await insert({ username: 'dup-b', email: 'db@x', gitAccount: 'shared ', admin: false });

    await gitAccountToScmIdentities.up(sink);

    expect((await sink.findUser('dup-a'))?.scmIdentities).toBeUndefined();
    expect((await sink.findUser('dup-b'))?.scmIdentities).toBeUndefined();
    expect(await sink.findUserByScmIdentity('github', 'shared')).toBeNull();
    // the unambiguous user is still migrated
    expect((await sink.findUser('linked'))?.scmIdentities).toEqual({ github: 'octocat' });
  });

  it('does not link a legacy handle that another user already holds', async () => {
    await insert({
      username: 'holder',
      email: 'h@x',
      scmIdentities: { github: 'claimed' },
      admin: false,
    });
    await insert({ username: 'late', email: 'lt@x', gitAccount: 'Claimed', admin: false });

    await gitAccountToScmIdentities.up(sink);

    expect((await sink.findUser('late'))?.scmIdentities).toBeUndefined();
    expect(await sink.findUserByScmIdentity('github', 'claimed')).toMatchObject({
      username: 'holder',
    });
  });

  it('down removes only the github identity it created', async () => {
    await gitAccountToScmIdentities.up(sink);
    await sink.updateUser({
      username: 'linked',
      scmIdentities: { github: 'octocat', gitlab: 'kept' },
    });

    await gitAccountToScmIdentities.down!(sink);

    expect((await sink.findUser('linked'))?.scmIdentities).toEqual({ gitlab: 'kept' });
    expect((await sink.findUser('already'))?.scmIdentities).toEqual({ gitlab: 'new-handle' });
  });
});
