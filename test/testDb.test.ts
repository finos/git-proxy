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

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as db from '../src/db';
import { Repo, User } from '../src/db/types';
import { Action } from '../src/proxy/actions/Action';
import { Step } from '../src/proxy/actions/Step';
import { AuthorisedRepo } from '../src/config/generated/config';
import { SAMPLE_REPO } from '../src/proxy/processors/constants';

const TEST_REPO = {
  project: 'finos',
  name: 'db-test-repo',
  url: 'https://github.com/finos/db-test-repo.git',
};

const TEST_NONEXISTENT_REPO = {
  project: 'MegaCorp',
  name: 'repo',
  url: 'https://example.com/MegaCorp/MegaGroup/repo.git',
  _id: 'ABCDEFGHIJKLMNOP',
};

const TEST_USER = {
  username: 'db-u1',
  password: 'abc',
  scmIdentities: { github: 'db-test-user' },
  email: 'db-test@test.com',
  admin: true,
  mustChangePassword: false,
};

const TEST_PUSH = new Action(
  '0000000000000000000000000000000000000000__1744380874110',
  'push',
  'get',
  1744380903338,
  TEST_REPO.url,
);
TEST_PUSH.user = TEST_USER.username;
TEST_PUSH.userEmail = TEST_USER.email;

const TEST_REPO_DOT_GIT = {
  project: 'finos',
  name: 'db.git-test-repo',
  url: 'https://github.com/finos/db.git-test-repo.git',
};

// the same as TEST_PUSH but with .git somewhere valid within the name
// to ensure a global replace isn't done when trimming, just to the end
const TEST_PUSH_DOT_GIT = new Action(
  '0000000000000000000000000000000000000000__1744380874110',
  'push',
  'get',
  1744380903338,
  'https://github.com/finos/db.git-test-repo.git',
);
TEST_PUSH_DOT_GIT.project = 'finos';
TEST_PUSH_DOT_GIT.repoName = 'db.git-test-repo.git';

/**
 * Clean up response data from the DB by removing an extraneous properties,
 * allowing comparison with expect.
 * @param {object} example Example element from which columns to retain are extracted
 * @param {array | object} responses Array of responses to clean.
 * @return {array}  Array of cleaned up responses.
 */
const cleanResponseData = <T extends object>(example: T, responses: T[] | T): T[] | T => {
  const columns = Object.keys(example);

  if (Array.isArray(responses)) {
    return responses.map((response) => {
      const cleanResponse: Partial<T> = {};
      columns.forEach((col) => {
        cleanResponse[col] = response[col];
      });
      return cleanResponse as T;
    });
  } else if (typeof responses === 'object') {
    const cleanResponse: Partial<T> = {};
    columns.forEach((col) => {
      cleanResponse[col] = responses[col];
    });
    return cleanResponse as T;
  } else {
    throw new Error(`Can only clean arrays or objects, but a ${typeof responses} was passed`);
  }
};

const ensureUserExists = async (testUser = TEST_USER) => {
  const existing = await db.findUser(testUser.username);
  if (!existing) {
    await db.createUser(
      testUser.username,
      testUser.password,
      testUser.email,
      testUser.admin,
      '',
      false,
      testUser.scmIdentities,
    );
  }
};

const ensureRepoExists = async (testRepo = TEST_REPO) => {
  let repo = await db.getRepoByUrl(testRepo.url);
  if (!repo) {
    await db.createRepo(testRepo);
    repo = await db.getRepoByUrl(testRepo.url);
  }
  if (!repo || !repo._id) throw new Error('Repo not found');
  return repo as Repo & { _id: string };
};

describe('Database clients', () => {
  beforeAll(async function () {
    // Ensure clean state - remove any leftover test data from previous runs or other test files
    const existingRepo = await db.getRepoByUrl(TEST_REPO.url);
    if (existingRepo) await db.deleteRepo(existingRepo._id!);

    const existingRepoDotGit = await db.getRepoByUrl(TEST_REPO_DOT_GIT.url);
    if (existingRepoDotGit) await db.deleteRepo(existingRepoDotGit._id!);

    await db.deleteUser(TEST_USER.username);
    await db.deletePush(TEST_PUSH.id);
    await db.deletePush(TEST_PUSH_DOT_GIT.id);
  });

  it('should be able to construct a repo instance', () => {
    const repo = new Repo(
      'project',
      'name',
      'https://github.com/finos.git-proxy.git',
      undefined,
      'id',
    );
    expect(repo._id).toBe('id');
    expect(repo.project).toBe('project');
    expect(repo.name).toBe('name');
    expect(repo.url).toBe('https://github.com/finos.git-proxy.git');
    expect(repo.users).toEqual({ canPush: [], canAuthorise: [] });

    const repo2 = new Repo(
      'project',
      'name',
      'https://github.com/finos.git-proxy.git',
      { canPush: ['bill'], canAuthorise: ['ben'] },
      'id',
    );
    expect(repo2.users).toEqual({ canPush: ['bill'], canAuthorise: ['ben'] });
  });

  it('should be able to construct a user instance', () => {
    const user = new User(
      'username',
      'password',
      { github: 'gitHandle' },
      'email@domain.com',
      true,
      null,
      [],
      'id',
    );
    expect(user.username).toBe('username');
    expect(user.scmIdentities.github).toBe('gitHandle');
    expect(user.email).toBe('email@domain.com');
    expect(user.admin).toBe(true);
    expect(user.oidcId).toBeNull();
    expect(user._id).toBe('id');

    const user2 = new User(
      'username',
      'password',
      { github: 'gitHandle' },
      'email@domain.com',
      false,
      'oidcId',
      [],
      'id',
    );
    expect(user2.admin).toBe(false);
    expect(user2.oidcId).toBe('oidcId');
  });

  it('should be able to construct a valid action instance', () => {
    const action = new Action(
      'id',
      'type',
      'method',
      Date.now(),
      'https://github.com/finos/git-proxy.git',
    );
    expect(action.project).toBe('finos');
    expect(action.repoName).toBe('git-proxy.git');
  });

  it('should be able to block an action by adding a blocked step', () => {
    const action = new Action(
      'id',
      'type',
      'method',
      Date.now(),
      'https://github.com/finos.git-proxy.git',
    );
    const step = new Step('stepName', false, null, false, null);
    step.setAsyncBlock('blockedMessage');
    action.addStep(step);
    expect(action.blocked).toBe(true);
    expect(action.blockedMessage).toBe('blockedMessage');
    expect(action.getLastStep()).toEqual(step);
    expect(action.continue()).toBe(false);
  });

  it('should be able to error an action by adding a step with an error', () => {
    const action = new Action(
      'id',
      'type',
      'method',
      Date.now(),
      'https://github.com/finos.git-proxy.git',
    );
    const step = new Step('stepName', true, 'errorMessage', false, null);
    action.addStep(step);
    expect(action.error).toBe(true);
    expect(action.errorMessage).toBe('errorMessage');
    expect(action.getLastStep()).toEqual(step);
    expect(action.continue()).toBe(false);
  });

  it('should be able to create a repo', async () => {
    // Clean up first in case another test or file left this repo
    const existing = await db.getRepoByUrl(TEST_REPO.url);
    if (existing) await db.deleteRepo(existing._id!);

    await db.createRepo(TEST_REPO);
    const repos = await db.getRepos();
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos).toContainEqual(TEST_REPO);
  });

  it('should be able to filter repos', async () => {
    await ensureRepoExists();

    // uppercase the filter value to confirm db client is lowercasing inputs
    const repos = await db.getRepos({ name: TEST_REPO.name.toUpperCase() });
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos[0]).toEqual(TEST_REPO);

    const repos2 = await db.getRepos({ url: TEST_REPO.url });
    const cleanRepos2 = cleanResponseData(TEST_REPO, repos2);
    expect(cleanRepos2[0]).toEqual(TEST_REPO);

    const repos3 = await db.getRepos();
    const repos4 = await db.getRepos({});
    expect(repos3).toEqual(expect.arrayContaining(repos4));
    expect(repos4).toEqual(expect.arrayContaining(repos3));
  });

  it('should be able to retrieve a repo by url', async () => {
    const repo = await ensureRepoExists();

    const cleanRepo = cleanResponseData(TEST_REPO, repo);
    expect(cleanRepo).toEqual(TEST_REPO);
  });

  it('should be able to retrieve a repo by id', async () => {
    const repo = await ensureRepoExists();

    const repoById = await db.getRepoById(repo._id);
    const cleanRepo = cleanResponseData(TEST_REPO, repoById!);
    expect(cleanRepo).toEqual(TEST_REPO);
  });

  it('should be able to delete a repo', async () => {
    const repo = await ensureRepoExists();

    await db.deleteRepo(repo._id);
    const repos = await db.getRepos();
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos).not.toContainEqual(TEST_REPO);
  });

  it('should be able to create a repo with a blank project', async () => {
    // Clean up first in case the repo already exists
    const existing = await db.getRepoByUrl(TEST_REPO.url);
    if (existing) await db.deleteRepo(existing._id!);

    const variations = [
      { project: null, name: TEST_REPO.name, url: TEST_REPO.url }, // null value
      { project: '', name: TEST_REPO.name, url: TEST_REPO.url }, // empty string
      { name: TEST_REPO.name, url: TEST_REPO.url }, // project undefined
    ];

    for (const testRepo of variations) {
      let threwError = false;
      try {
        const repo = await db.createRepo(testRepo as AuthorisedRepo);
        await db.deleteRepo(repo._id);
      } catch {
        threwError = true;
      }
      expect(threwError).toBe(false);
    }
  });

  it('should NOT be able to create a repo with blank name or url', async () => {
    const invalids = [
      { project: TEST_REPO.project, name: null, url: TEST_REPO.url }, // null name
      { project: TEST_REPO.project, name: '', url: TEST_REPO.url }, // blank name
      { project: TEST_REPO.project, url: TEST_REPO.url }, // undefined name
      { project: TEST_REPO.project, name: TEST_REPO.name, url: null }, // null url
      { project: TEST_REPO.project, name: TEST_REPO.name, url: '' }, // blank url
      { project: TEST_REPO.project, name: TEST_REPO.name }, // undefined url
    ];

    for (const bad of invalids) {
      await expect(db.createRepo(bad as AuthorisedRepo)).rejects.toThrow();
    }
  });

  it('should throw an error when creating a user and username or email is not set', async () => {
    // null username
    await expect(
      db.createUser(
        null as unknown as string,
        TEST_USER.password,
        TEST_USER.email,
        TEST_USER.admin,
      ),
    ).rejects.toThrow('username cannot be empty');

    // blank username
    await expect(
      db.createUser('', TEST_USER.password, TEST_USER.email, TEST_USER.admin),
    ).rejects.toThrow('username cannot be empty');

    // null email
    await expect(
      db.createUser(
        TEST_USER.username,
        TEST_USER.password,
        null as unknown as string,
        TEST_USER.admin,
      ),
    ).rejects.toThrow('email cannot be empty');

    // blank email
    await expect(
      db.createUser(TEST_USER.username, TEST_USER.password, '', TEST_USER.admin),
    ).rejects.toThrow('email cannot be empty');
  });

  it('should be able to create a user', async () => {
    // Clean up first
    await db.deleteUser(TEST_USER.username);

    await db.createUser(
      TEST_USER.username,
      TEST_USER.password,
      TEST_USER.email,
      TEST_USER.admin,
      '',
      false,
      TEST_USER.scmIdentities,
    );
    const users = await db.getUsers();
    // remove password as it will have been hashed
    const { password: _, ...TEST_USER_CLEAN } = TEST_USER;
    const cleanUsers = cleanResponseData(TEST_USER_CLEAN, users);
    expect(cleanUsers).toContainEqual(TEST_USER_CLEAN);
  });

  it('should throw an error when creating a duplicate username', async () => {
    await ensureUserExists();

    await expect(
      db.createUser(
        TEST_USER.username,
        TEST_USER.password,
        'prefix_' + TEST_USER.email,
        TEST_USER.admin,
      ),
    ).rejects.toThrow(`user ${TEST_USER.username} already exists`);
  });

  it('should throw an error when creating a user with a duplicate email', async () => {
    await ensureUserExists();

    await expect(
      db.createUser(
        'prefix_' + TEST_USER.username,
        TEST_USER.password,
        TEST_USER.email,
        TEST_USER.admin,
      ),
    ).rejects.toThrow(`A user with email ${TEST_USER.email} already exists`);
  });

  it('should be able to find a user', async () => {
    await ensureUserExists();

    const user = await db.findUser(TEST_USER.username);
    const { password: _, ...TEST_USER_CLEAN } = TEST_USER;
    const { password: _2, _id: _3, publicKeys: _4, ...DB_USER_CLEAN } = user!;
    expect(DB_USER_CLEAN).toEqual(TEST_USER_CLEAN);
  });

  it('should be able to filter getUsers', async () => {
    await ensureUserExists();

    const users = await db.getUsers({ username: TEST_USER.username.toUpperCase() });
    const { password: _, ...TEST_USER_CLEAN } = TEST_USER;
    const cleanUsers = cleanResponseData(TEST_USER_CLEAN, users);
    expect(cleanUsers[0]).toEqual(TEST_USER_CLEAN);

    const users2 = await db.getUsers({ email: TEST_USER.email.toUpperCase() });
    const cleanUsers2 = cleanResponseData(TEST_USER_CLEAN, users2);
    expect(cleanUsers2[0]).toEqual(TEST_USER_CLEAN);
  });

  it('should be able to delete a user', async () => {
    await ensureUserExists();

    await db.deleteUser(TEST_USER.username);
    const users = await db.getUsers();
    const cleanUsers = cleanResponseData(TEST_USER, users as any);
    expect(cleanUsers).not.toContainEqual(TEST_USER);
  });

  it('should be able to update a user', async () => {
    // Ensure user doesn't exist first
    await db.deleteUser(TEST_USER.username);

    await db.createUser(
      TEST_USER.username,
      TEST_USER.password,
      TEST_USER.email,
      TEST_USER.admin,
      '',
      false,
      TEST_USER.scmIdentities,
    );

    // has fewer properties to prove that records are merged
    const updateToApply = {
      username: TEST_USER.username,
      scmIdentities: { github: 'updatedGitHandle' },
      admin: false,
    };

    const updatedUser = {
      // remove password as it will have been hashed
      username: TEST_USER.username,
      email: TEST_USER.email,
      scmIdentities: { github: 'updatedGitHandle' },
      admin: false,
    };

    await db.updateUser(updateToApply);

    const users = await db.getUsers();
    const cleanUsers = cleanResponseData(updatedUser, users);
    expect(cleanUsers).toContainEqual(updatedUser);

    await db.deleteUser(TEST_USER.username);
  });

  it('should be able to create a user via updateUser', async () => {
    // Ensure user doesn't exist first
    await db.deleteUser(TEST_USER.username);

    await db.updateUser(TEST_USER);
    const users = await db.getUsers();
    // remove password as it will have been hashed
    const { password: _, mustChangePassword: _2, ...TEST_USER_CLEAN } = TEST_USER;
    const cleanUsers = cleanResponseData(TEST_USER_CLEAN, users);
    expect(cleanUsers).toContainEqual(TEST_USER_CLEAN);
  });

  it('should throw an error when authorising a user to push on non-existent repo', async () => {
    await expect(
      db.addUserCanPush(TEST_NONEXISTENT_REPO._id, TEST_USER.username),
    ).rejects.toThrow();
  });

  it('should be able to authorise a user to push and confirm that they can', async () => {
    // Ensure repo exists
    const existingRepo = await db.getRepoByUrl(TEST_REPO.url);
    if (existingRepo) await db.deleteRepo(existingRepo._id!);

    // first create the repo and check that user is not allowed to push
    await db.createRepo(TEST_REPO);

    let allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username);
    expect(allowed).toBe(false);

    const repo = await db.getRepoByUrl(TEST_REPO.url);
    if (!repo || !repo._id) {
      throw new Error('Repo not found');
    }

    // uppercase the filter value to confirm db client is lowercasing inputs
    await db.addUserCanPush(repo._id, TEST_USER.username.toUpperCase());

    // repeat, should not throw an error if already set
    await db.addUserCanPush(repo._id, TEST_USER.username.toUpperCase());

    // confirm the setting exists
    allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username);
    expect(allowed).toBe(true);

    // confirm that casing doesn't matter
    allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username.toUpperCase());
    expect(allowed).toBe(true);
  });

  it('should throw an error when de-authorising a user to push on non-existent repo', async () => {
    await expect(
      db.removeUserCanPush(TEST_NONEXISTENT_REPO._id, TEST_USER.username),
    ).rejects.toThrow();
  });

  it("should be able to de-authorise a user to push and confirm that they can't", async () => {
    const repo = await ensureRepoExists();

    // Ensure user can push
    await db.addUserCanPush(repo._id, TEST_USER.username);

    let allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username);
    expect(allowed).toBe(true);

    // uppercase the filter value to confirm db client is lowercasing inputs
    await db.removeUserCanPush(repo._id, TEST_USER.username.toUpperCase());

    // repeat, should not throw an error if already set
    await db.removeUserCanPush(repo._id, TEST_USER.username.toUpperCase());

    // confirm the setting exists
    allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username);
    expect(allowed).toBe(false);

    // confirm that casing doesn't matter
    allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username.toUpperCase());
    expect(allowed).toBe(false);
  });

  it('should throw an error when authorising a user to authorise on non-existent repo', async () => {
    await expect(
      db.addUserCanAuthorise(TEST_NONEXISTENT_REPO._id, TEST_USER.username),
    ).rejects.toThrow();
  });

  it('should throw an error when de-authorising a user to push on non-existent repo', async () => {
    await expect(
      db.removeUserCanAuthorise(TEST_NONEXISTENT_REPO._id, TEST_USER.username),
    ).rejects.toThrow();
  });

  it('should NOT throw an error when checking whether a user can push on non-existent repo', async () => {
    const allowed = await db.isUserPushAllowed(TEST_NONEXISTENT_REPO.url, TEST_USER.username);
    expect(allowed).toBe(false);
  });

  describe('push operations', () => {
    beforeEach(async () => {
      await db.deletePush(TEST_PUSH.id);
    });

    it('should be able to create a push', async () => {
      await db.writeAudit(TEST_PUSH);
      const pushes = await db.getPushes({});
      const cleanPushes = cleanResponseData(TEST_PUSH, pushes);
      expect(cleanPushes).toContainEqual(TEST_PUSH);
    }, 20000);

    it('should be able to delete a push', async () => {
      // Create push
      await db.writeAudit(TEST_PUSH);
      await db.deletePush(TEST_PUSH.id);
      const pushes = await db.getPushes({});
      const cleanPushes = cleanResponseData(TEST_PUSH, pushes);
      expect(cleanPushes).not.toContainEqual(TEST_PUSH);
    });

    it('should be able to authorise a push', async () => {
      await db.writeAudit(TEST_PUSH);
      const msg = await db.authorise(TEST_PUSH.id, undefined);
      expect(msg).toHaveProperty('message');
    });

    it('should throw an error when authorising a non-existent a push', async () => {
      await expect(db.authorise(TEST_PUSH.id, undefined)).rejects.toThrow();
    });

    it('should be able to reject a push', async () => {
      await db.writeAudit(TEST_PUSH);
      const msg = await db.reject(TEST_PUSH.id, undefined);
      expect(msg).toHaveProperty('message');
    });

    it('should throw an error when rejecting a non-existent a push', async () => {
      await expect(db.reject(TEST_PUSH.id, undefined)).rejects.toThrow();
    });

    it('should be able to cancel a push', async () => {
      await db.writeAudit(TEST_PUSH);
      const msg = await db.cancel(TEST_PUSH.id);
      expect(msg).toHaveProperty('message');
    });

    it('should throw an error when cancelling a non-existent a push', async () => {
      await expect(db.cancel(TEST_PUSH.id)).rejects.toThrow();
    });

    it('should be able to check if a user can cancel push', async () => {
      const repo = await ensureRepoExists();
      await ensureUserExists();

      // Ensure user is NOT in canPush
      await db.removeUserCanPush(repo._id, TEST_USER.username);

      // push does not exist yet, should return false
      let allowed = await db.canUserCancelPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).toBe(false);

      // create the push - user should already exist and not authorised to push
      await db.writeAudit(TEST_PUSH);
      allowed = await db.canUserCancelPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).toBe(false);

      // authorise user and recheck
      await db.addUserCanPush(repo._id, TEST_USER.username);
      allowed = await db.canUserCancelPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).toBe(true);

      // deauthorise user and recheck
      await db.removeUserCanPush(repo._id, TEST_USER.username);
      allowed = await db.canUserCancelPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).toBe(false);
    });

    it('should be able to check if a user can approve/reject push', async () => {
      const repo = await ensureRepoExists();
      await ensureUserExists();

      let allowed = await db.canUserApproveRejectPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).toBe(false);

      // push does not exist yet, should return false
      await db.writeAudit(TEST_PUSH);
      allowed = await db.canUserApproveRejectPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).toBe(false);

      await db.addUserCanAuthorise(repo._id, TEST_USER.username);
      allowed = await db.canUserApproveRejectPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).toBe(true);

      // deauthorise user and recheck
      await db.removeUserCanAuthorise(repo._id, TEST_USER.username);
      allowed = await db.canUserApproveRejectPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).toBe(false);
    });
  });

  it('should be able to check if a user can approve/reject push including .git within the repo name', async () => {
    // Clean up first
    const existingRepo = await db.getRepoByUrl(TEST_REPO_DOT_GIT.url);
    if (existingRepo) await db.deleteRepo(existingRepo._id!);
    await ensureUserExists();
    await db.deletePush(TEST_PUSH_DOT_GIT.id);

    const repo = await db.createRepo(TEST_REPO_DOT_GIT);

    // push does not exist yet, should return false
    let allowed = await db.canUserApproveRejectPush(TEST_PUSH_DOT_GIT.id, TEST_USER.username);
    expect(allowed).toBe(false);

    // create the push - user should already exist and not authorised to push
    await db.writeAudit(TEST_PUSH_DOT_GIT);
    allowed = await db.canUserApproveRejectPush(TEST_PUSH_DOT_GIT.id, TEST_USER.username);
    expect(allowed).toBe(false);

    // authorise user and recheck
    await db.addUserCanAuthorise(repo._id, TEST_USER.username);
    allowed = await db.canUserApproveRejectPush(TEST_PUSH_DOT_GIT.id, TEST_USER.username);
    expect(allowed).toBe(true);

    // clean up
    await db.deletePush(TEST_PUSH_DOT_GIT.id);
    await db.removeUserCanAuthorise(repo._id, TEST_USER.username);
  });

  it('should be able to find user by scm identity', async () => {
    await ensureUserExists();

    const user = await db.findUserByScmIdentity('github', 'db-test-user');
    expect(user).not.toBeNull();
    expect(user?.username).toBe(TEST_USER.username);
  });

  it('should find user by scm identity case-insensitively', async () => {
    await ensureUserExists();

    const user = await db.findUserByScmIdentity('github', 'DB-TEST-USER');
    expect(user).not.toBeNull();
    expect(user?.username).toBe(TEST_USER.username);
  });

  it('should return null when scm identity not found', async () => {
    const user = await db.findUserByScmIdentity('github', 'nonexistent');
    expect(user).toBeNull();
  });

  it('should return null with wrong provider', async () => {
    await ensureUserExists();

    const user = await db.findUserByScmIdentity('gitlab', 'db-test-user');
    expect(user).toBeNull();
  });

  it('should return null with invalid provider name', async () => {
    const user = await db.findUserByScmIdentity('$bad', 'octocat');
    expect(user).toBeNull();
  });

  it('should link an scm identity to a user', async () => {
    // Create a clean user
    const username = 'scm-test-user';
    await db.deleteUser(username);
    await db.createUser(username, 'password', 'scm@example.com', false);

    await db.setUserScmIdentity(username, 'gitlab', 'gitlabuser');

    const user = await db.findUser(username);
    expect(user?.scmIdentities.gitlab).toBe('gitlabuser');

    // cleanup
    await db.deleteUser(username);
  });

  it('should relink an scm identity to a user', async () => {
    // Create a clean user
    const username = 'scm-relink-user';
    await db.deleteUser(username);
    await db.createUser(username, 'password', 'scm-relink@example.com', false, '', false, {
      gitlab: 'oldhandle',
    });

    await db.setUserScmIdentity(username, 'gitlab', 'newhandle');

    const user = await db.findUser(username);
    expect(user?.scmIdentities.gitlab).toBe('newhandle');

    // cleanup
    await db.deleteUser(username);
  });

  it('should unlink an scm identity from a user', async () => {
    // Create a clean user
    const username = 'scm-unlink-user';
    await db.deleteUser(username);
    await db.createUser(username, 'password', 'scm-unlink@example.com', false, '', false, {
      github: 'githubuser',
    });

    await db.setUserScmIdentity(username, 'github', null);

    const user = await db.findUser(username);
    expect(user?.scmIdentities.github).toBeUndefined();

    // cleanup
    await db.deleteUser(username);
  });

  it('should throw error when linking identity already held by another user', async () => {
    // Create two clean users
    const user1 = 'conflict-user-1';
    const user2 = 'conflict-user-2';
    await db.deleteUser(user1);
    await db.deleteUser(user2);
    await db.createUser(user1, 'password', 'conflict1@example.com', false, '', false, {
      github: 'octocat',
    });
    await db.createUser(user2, 'password', 'conflict2@example.com', false);

    await expect(db.setUserScmIdentity(user2, 'github', 'octocat')).rejects.toThrow(
      'github account octocat is already linked to another user',
    );

    // cleanup
    await db.deleteUser(user1);
    await db.deleteUser(user2);
  });

  it('should reject a link that only differs from an existing one by case or whitespace', async () => {
    const user1 = 'norm-user-1';
    const user2 = 'norm-user-2';
    await db.deleteUser(user1);
    await db.deleteUser(user2);
    await db.createUser(user1, 'password', 'norm1@example.com', false, '', false, {
      github: 'octocat',
    });
    await db.createUser(user2, 'password', 'norm2@example.com', false);

    await expect(db.setUserScmIdentity(user2, 'github', '  OctoCat ')).rejects.toThrow(
      'github account octocat is already linked to another user',
    );
    expect((await db.findUser(user2))?.scmIdentities?.github).toBeUndefined();

    await db.deleteUser(user1);
    await db.deleteUser(user2);
  });

  it('should reject creating a user with an identity another user already holds', async () => {
    const user1 = 'create-dup-1';
    const user2 = 'create-dup-2';
    await db.deleteUser(user1);
    await db.deleteUser(user2);
    await db.createUser(user1, 'password', 'cd1@example.com', false, '', false, {
      github: 'taken-handle',
    });

    await expect(
      db.createUser(user2, 'password', 'cd2@example.com', false, '', false, {
        github: ' Taken-Handle ',
      }),
    ).rejects.toThrow('github account taken-handle is already linked to another user');
    expect(await db.findUser(user2)).toBeNull();

    await db.deleteUser(user1);
  });

  it('resolves every spelling of a handle to the one user linked under it', async () => {
    const user1 = 'case-user-1';
    await db.deleteUser(user1);
    await db.createUser(user1, 'password', 'case1@example.com', false, '', false, {
      github: 'OctoCat',
    });

    for (const spelling of ['octocat', 'OCTOCAT', 'OctoCat', ' octocat ']) {
      expect((await db.findUserByScmIdentity('github', spelling))?.username).toBe(user1);
    }

    await db.deleteUser(user1);
  });

  it('should throw error when user not found', async () => {
    await expect(db.setUserScmIdentity('nonexistent-user', 'github', 'octocat')).rejects.toThrow(
      'user nonexistent-user not found',
    );
  });

  afterAll(async () => {
    // _id is autogenerated by the DB so we need to retrieve it before we can use it
    const repo = await db.getRepoByUrl(TEST_REPO.url);
    if (repo) await db.deleteRepo(repo._id!);

    const repoDotGit = await db.getRepoByUrl(TEST_REPO_DOT_GIT.url);
    if (repoDotGit) await db.deleteRepo(repoDotGit._id!);

    await db.deleteUser(TEST_USER.username);
    await db.deletePush(TEST_PUSH.id);
    await db.deletePush(TEST_PUSH_DOT_GIT.id);
  });
});
