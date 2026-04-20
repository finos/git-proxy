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
import { useRepoViewsListQuery } from '../../src/ui/query/useRepoViewsListQuery';

const navigateMock = vi.fn();

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../src/ui/services/repo', () => ({
  fetchRepoViews: vi.fn(),
}));

import { fetchRepoViews } from '../../src/ui/services/repo';
const fetchRepoViewsMock = fetchRepoViews as ReturnType<typeof vi.fn>;

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

describe('useRepoViewsListQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns repo list on success', async () => {
    const reposData = [
      { name: 'alpha-repo', project: 'org' },
      { name: 'zebra-repo', project: 'org' },
    ];
    fetchRepoViewsMock.mockResolvedValue({ success: true, data: reposData });

    const { result } = renderHook(() => useRepoViewsListQuery(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(reposData);
  });

  it('navigates to /login and throws on 401', async () => {
    fetchRepoViewsMock.mockResolvedValue({
      success: false,
      status: 401,
      message: 'Not authenticated',
    });

    const { result } = renderHook(() => useRepoViewsListQuery(true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    expect((result.current.error as Error).message).toBe('Not authenticated');
  });

  it('throws with message on non-401 failure', async () => {
    fetchRepoViewsMock.mockResolvedValue({
      success: false,
      status: 500,
      message: 'Database connection failed',
    });

    const { result } = renderHook(() => useRepoViewsListQuery(true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(navigateMock).not.toHaveBeenCalled();
    expect((result.current.error as Error).message).toBe('Database connection failed');
  });

  it('is disabled when enabled is false', () => {
    const { result } = renderHook(() => useRepoViewsListQuery(false), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchRepoViewsMock).not.toHaveBeenCalled();
  });
});
