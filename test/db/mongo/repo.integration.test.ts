/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRepo,
  getRepo,
  getRepos,
  getRepoById,
  getRepoByUrl,
  addUserCanPush,
  addUserCanAuthorise,
  removeUserCanPush,
  removeUserCanAuthorise,
  deleteRepo,
} from '../../../src/db/mongo/repo';
import { Repo } from '../../../src/db/types';

const shouldRunMongoTests = process.env.RUN_MONGO_TESTS === 'true';

describe.runIf(shouldRunMongoTests)('MongoDB Repo Integration Tests', () => {
  const createTestRepo = (overrides: Partial<Repo> = {}): Repo => {
    return new Repo(
      overrides.project || 'test-project',
      overrides.name || `test-repo-${Date.now()}`,
      overrides.url || `https://github.com/test/repo-${Date.now()}.git`,
      overrides.users || { canPush: [], canAuthorise: [] },
    );
  };

  describe('createRepo', () => {
    it('should create a new repo and return it with an _id', async () => {
      const repo = createTestRepo({ name: 'create-test-repo' });

      const result = await createRepo(repo);

      expect(result._id).toBeDefined();
      expect(result.name).toBe('create-test-repo');
      expect(result.project).toBe('test-project');
    });

    it('should persist the repo to the database', async () => {
      const repo = createTestRepo({ name: 'persist-test-repo' });

      const created = await createRepo(repo);
      const fetched = await getRepoById(created._id!);

      expect(fetched).not.toBeNull();
      expect(fetched?.name).toBe('persist-test-repo');
    });
  });

  describe('getRepo', () => {
    it('should retrieve a repo by name (case-insensitive)', async () => {
      const repo = createTestRepo({ name: 'case-test-repo' });
      await createRepo(repo);

      const result = await getRepo('CASE-TEST-REPO');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('case-test-repo');
    });

    it('should return null for non-existent repo', async () => {
      const result = await getRepo('non-existent-repo');

      expect(result).toBeNull();
    });
  });

  describe('getRepoByUrl', () => {
    it('should retrieve a repo by URL', async () => {
      const url = 'https://github.com/test/url-test.git';
      const repo = createTestRepo({ url });
      await createRepo(repo);

      const result = await getRepoByUrl(url);

      expect(result).not.toBeNull();
      expect(result?.url).toBe(url);
    });

    it('should return null for non-existent URL', async () => {
      const result = await getRepoByUrl('https://github.com/non-existent/repo.git');

      expect(result).toBeNull();
    });
  });

  describe('getRepos', () => {
    it('should retrieve all repos', async () => {
      await createRepo(createTestRepo({ name: 'list-repo-1' }));
      await createRepo(createTestRepo({ name: 'list-repo-2' }));

      const result = await getRepos();

      expect(result.length).toBeGreaterThanOrEqual(2);
      const names = result.map((r) => r.name);
      expect(names).toContain('list-repo-1');
      expect(names).toContain('list-repo-2');
    });

    it('should filter repos by query', async () => {
      await createRepo(createTestRepo({ name: 'filter-repo', project: 'filter-project' }));
      await createRepo(createTestRepo({ name: 'other-repo', project: 'other-project' }));

      const result = await getRepos({ project: 'filter-project' });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('filter-repo');
    });
  });

  describe('user management', () => {
    let testRepoId: string;

    beforeEach(async () => {
      const repo = createTestRepo({ name: 'user-mgmt-repo' });
      const created = await createRepo(repo);
      testRepoId = created._id!;
    });

    it('should add a user to canPush (lowercased)', async () => {
      await addUserCanPush(testRepoId, 'TestUser');

      const repo = await getRepoById(testRepoId);
      expect(repo?.users.canPush).toContain('testuser');
    });

    it('should add a user to canAuthorise (lowercased)', async () => {
      await addUserCanAuthorise(testRepoId, 'AuthUser');

      const repo = await getRepoById(testRepoId);
      expect(repo?.users.canAuthorise).toContain('authuser');
    });

    it('should remove a user from canPush', async () => {
      await addUserCanPush(testRepoId, 'removeuser');
      await removeUserCanPush(testRepoId, 'RemoveUser');

      const repo = await getRepoById(testRepoId);
      expect(repo?.users.canPush).not.toContain('removeuser');
    });

    it('should remove a user from canAuthorise', async () => {
      await addUserCanAuthorise(testRepoId, 'removeauth');
      await removeUserCanAuthorise(testRepoId, 'RemoveAuth');

      const repo = await getRepoById(testRepoId);
      expect(repo?.users.canAuthorise).not.toContain('removeauth');
    });
  });

  describe('deleteRepo', () => {
    it('should delete a repo by id', async () => {
      const repo = createTestRepo({ name: 'delete-test-repo' });
      const created = await createRepo(repo);

      await deleteRepo(created._id!);

      const result = await getRepoById(created._id!);
      expect(result).toBeNull();
    });
  });
});
