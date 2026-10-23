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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRepo } from '../../src/ui/query/useRepoQuery';

vi.mock('../../src/ui/services/repo', () => ({
  getRepo: vi.fn(),
}));

import { getRepo } from '../../src/ui/services/repo';
const getRepoMock = getRepo as ReturnType<typeof vi.fn>;

describe('fetchRepo', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns repo data on success', async () => {
    const repoData = { name: 'test-repo', project: 'org' };
    getRepoMock.mockResolvedValue({ success: true, data: repoData });

    const result = await fetchRepo('repo-1', navigate);

    expect(result).toEqual(repoData);
    expect(getRepoMock).toHaveBeenCalledWith('repo-1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to /login and throws on 401', async () => {
    getRepoMock.mockResolvedValue({ success: false, status: 401, message: 'Not logged in' });

    await expect(fetchRepo('repo-1', navigate)).rejects.toThrow('Not logged in');
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('throws with message on non-401 failure', async () => {
    getRepoMock.mockResolvedValue({
      success: false,
      status: 403,
      message: 'User not authorised on this repository',
    });

    await expect(fetchRepo('repo-1', navigate)).rejects.toThrow(
      'User not authorised on this repository',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('throws fallback message when result has no message', async () => {
    getRepoMock.mockResolvedValue({ success: false, status: 500 });

    await expect(fetchRepo('repo-1', navigate)).rejects.toThrow('Failed to load repository');
  });
});
