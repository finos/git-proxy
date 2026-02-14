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

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { Repo } from '../../../src/db/types';

const mockFindOne = vi.fn();
const mockConnect = vi.fn(() => ({
  findOne: mockFindOne,
}));

vi.mock('../../../src/db/mongo/helper', () => ({
  connect: mockConnect,
}));

describe('MongoDB', async () => {
  const { getRepo, getRepoByUrl } = await import('../../../src/db/mongo/repo');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRepo', () => {
    it('should get the repo using the name', async () => {
      const repoData: Partial<Repo> = {
        name: 'sample',
        users: { canPush: [], canAuthorise: [] },
        url: 'http://example.com/sample-repo.git',
      };

      mockFindOne.mockResolvedValue(repoData);

      const result = await getRepo('Sample');

      expect(result).toEqual(repoData);
      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFindOne).toHaveBeenCalledWith({ name: { $eq: 'sample' } });
    });
  });

  describe('getRepoByUrl', () => {
    it('should get the repo using the url', async () => {
      const repoData: Partial<Repo> = {
        name: 'sample',
        users: { canPush: [], canAuthorise: [] },
        url: 'https://github.com/finos/git-proxy.git',
      };

      mockFindOne.mockResolvedValue(repoData);

      const result = await getRepoByUrl('https://github.com/finos/git-proxy.git');

      expect(result).toEqual(repoData);
      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFindOne).toHaveBeenCalledWith({
        url: { $eq: 'https://github.com/finos/git-proxy.git' },
      });
    });
  });
});
