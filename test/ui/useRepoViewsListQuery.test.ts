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
import { fetchRepoViewsList } from '../../src/ui/query/useRepoViewsListQuery';

vi.mock('../../src/ui/services/repo', () => ({
  fetchRepoViews: vi.fn(),
}));

import { fetchRepoViews } from '../../src/ui/services/repo';
const fetchRepoViewsMock = fetchRepoViews as ReturnType<typeof vi.fn>;

describe('fetchRepoViewsList', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns repo list on success', async () => {
    const reposData = [
      { name: 'alpha-repo', project: 'org' },
      { name: 'zebra-repo', project: 'org' },
    ];
    fetchRepoViewsMock.mockResolvedValue({ success: true, data: reposData });

    const result = await fetchRepoViewsList(navigate);

    expect(result).toEqual(reposData);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to /login and throws on 401', async () => {
    fetchRepoViewsMock.mockResolvedValue({
      success: false,
      status: 401,
      message: 'Not authenticated',
    });

    await expect(fetchRepoViewsList(navigate)).rejects.toThrow('Not authenticated');
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('throws with message on non-401 failure', async () => {
    fetchRepoViewsMock.mockResolvedValue({
      success: false,
      status: 500,
      message: 'Database connection failed',
    });

    await expect(fetchRepoViewsList(navigate)).rejects.toThrow('Database connection failed');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('throws fallback message when result has no message', async () => {
    fetchRepoViewsMock.mockResolvedValue({ success: false, status: 500 });

    await expect(fetchRepoViewsList(navigate)).rejects.toThrow('Failed to load repositories');
  });
});
