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

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import React from 'react';
import { useRepoQuery } from '../../src/ui/query/useRepoQuery';

const navigateMock = vi.fn();

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../src/ui/services/repo', () => ({
  getRepo: vi.fn(),
}));

import { getRepo } from '../../src/ui/services/repo';
const getRepoMock = getRepo as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(MemoryRouter, null, children),
  );
}

describe('useRepoQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns repo data on success', async () => {
    const repoData = { name: 'test-repo', project: 'org' };
    getRepoMock.mockResolvedValue({ success: true, data: repoData });

    const { result } = renderHook(() => useRepoQuery('repo-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(repoData);
    expect(getRepoMock).toHaveBeenCalledWith('repo-1');
  });

  it('navigates to /login and throws on 401', async () => {
    getRepoMock.mockResolvedValue({ success: false, status: 401, message: 'Not logged in' });

    const { result } = renderHook(() => useRepoQuery('repo-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    expect((result.current.error as Error).message).toBe('Not logged in');
  });

  it('throws with message on non-401 failure', async () => {
    getRepoMock.mockResolvedValue({
      success: false,
      status: 403,
      message: 'User not authorised on this repository',
    });

    const { result } = renderHook(() => useRepoQuery('repo-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(navigateMock).not.toHaveBeenCalled();
    expect((result.current.error as Error).message).toBe('User not authorised on this repository');
  });

  it('is disabled when id is undefined', () => {
    const { result } = renderHook(() => useRepoQuery(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getRepoMock).not.toHaveBeenCalled();
  });
});
