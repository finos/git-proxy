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

import React, { useContext, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { sortRepoViews } from '../../../services/repo';
import NewRepo from './NewRepo';
import { RepoView } from '../../../types';
import { UserContext, UserContextType } from '../../../context';
import { useAuth } from '../../../auth/AuthProvider';
import Danger from '../../../components/Typography/Danger';
import RepoListTable from './RepoListTable';
import { applyRepoListUrlPatch, parseRepoListUrlState } from './repoListQuery';
import { type RepoSortField } from './RepositoriesSortMenu';
import { useRepoViewsListQuery } from '../../../query/useRepoViewsListQuery';
import { repoQueryKeys } from '../../../query/repoQueryKeys';
import { useClientPagination } from '../../../hooks/useClientPagination';

export default function Repositories(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const itemsPerPage: number = 20;
  const { user } = useContext<UserContextType>(UserContext);
  const { isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { sort, filter, page } = useMemo(() => parseRepoListUrlState(searchParams), [searchParams]);

  const {
    data: repoListRaw,
    isPending: repoListPending,
    isError: repoListError,
    error: repoListErrorObj,
  } = useRepoViewsListQuery(!authLoading);

  const repos = useMemo(
    () =>
      repoListRaw ? sortRepoViews(repoListRaw, sort, user?.username ?? null) : ([] as RepoView[]),
    [repoListRaw, sort, user?.username],
  );

  const handleSortChange = useCallback(
    (next: RepoSortField) => {
      setSearchParams((prev) => applyRepoListUrlPatch(prev, { sort: next }), { replace: true });
    },
    [setSearchParams],
  );

  const refreshRepoList = useCallback(
    async (_repo: RepoView) => {
      await queryClient.invalidateQueries({ queryKey: repoQueryKeys.list() });
    },
    [queryClient],
  );

  const handleSearch = useCallback(
    (query: string): void => {
      setSearchParams((prev) => applyRepoListUrlPatch(prev, { filter: query, page: 1 }), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const handlePageChange = useCallback(
    (nextPage: number): void => {
      setSearchParams((prev) => applyRepoListUrlPatch(prev, { page: nextPage }), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const filteredRepos = useMemo(() => {
    if (!filter) return repos;
    const lowercasedQuery = filter.toLowerCase();
    return repos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(lowercasedQuery) ||
        repo.project.toLowerCase().includes(lowercasedQuery),
    );
  }, [repos, filter]);

  const isLoading = authLoading || repoListPending || !repoListRaw;

  const { effectivePage, currentItems: paginatedRepos } = useClientPagination(
    filteredRepos,
    page,
    itemsPerPage,
    isLoading,
    (corrected) =>
      setSearchParams((p) => applyRepoListUrlPatch(p, { page: corrected }), { replace: true }),
  );

  if (authLoading || (repoListPending && !repoListRaw)) {
    return <div>Loading...</div>;
  }
  if (repoListError) {
    return (
      <Danger>
        {repoListErrorObj instanceof Error
          ? repoListErrorObj.message
          : 'Failed to load repositories'}
      </Danger>
    );
  }

  const newRepoAction = user?.admin ? <NewRepo onSuccess={refreshRepoList} /> : null;

  return (
    <RepoListTable
      repos={paginatedRepos}
      newRepoAction={newRepoAction}
      filterValue={filter}
      onSearch={handleSearch}
      sort={sort}
      onSortChange={handleSortChange}
      currentPage={effectivePage}
      totalItems={filteredRepos.length}
      itemsPerPage={itemsPerPage}
      onPageChange={handlePageChange}
    />
  );
}
