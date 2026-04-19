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

import React, { type FC, useCallback, useMemo, useState } from 'react';
import { useClientPagination } from '../../hooks/useClientPagination';
import { useSearchParams } from 'react-router';
import { PageHeader, Stack } from '@primer/react';
import { GitProxyUnderlineNav } from '../../components/GitProxyUnderlineTabs';
import type { IconProps } from '@primer/octicons-react';
import {
  AlertIcon,
  BlockedIcon,
  CheckCircleIcon,
  EyeIcon,
  ListUnorderedIcon,
  XCircleIcon,
} from '@primer/octicons-react';
import PushesTable from './components/PushesTable';
import Danger from '../../components/Typography/Danger';
import ListFilterInput from '../../components/ListFilterInput/ListFilterInput';
import { sortRepoViews } from '../../services/repo';
import { useRepoViewsListQuery } from '../../query/useRepoViewsListQuery';
import { usePushesQuery } from '../../query/usePushesQuery';
import { canonicalRemoteUrl } from '../../utils/parseGitRemoteUrl';
import {
  applyActivityListUrlPatch,
  parseActivityListUrlState,
  type ActivityTab,
} from './activityListQuery';
import {
  buildRepoDisplayIndex,
  countActivitiesByTab,
  filterActivitiesForTab,
  filterActivityBySearch,
} from './activityTabFilters';

const ACTIVITY_ITEMS_PER_PAGE = 100;

type TabDef = {
  id: ActivityTab;
  label: string;
  NavIcon: FC<IconProps>;
};

const ACTIVITY_TABS: TabDef[] = [
  { id: 'all', label: 'All', NavIcon: ListUnorderedIcon },
  { id: 'pending', label: 'Pending', NavIcon: EyeIcon },
  { id: 'approved', label: 'Approved', NavIcon: CheckCircleIcon },
  { id: 'canceled', label: 'Canceled', NavIcon: XCircleIcon },
  { id: 'rejected', label: 'Rejected', NavIcon: BlockedIcon },
  { id: 'error', label: 'Error', NavIcon: AlertIcon },
];

const PushRequests = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    tab: activeTab,
    filter,
    page,
    repo: repoIdFilter,
  } = useMemo(() => parseActivityListUrlState(searchParams), [searchParams]);
  const { data: repoListRaw } = useRepoViewsListQuery(true);
  const registeredRepos = useMemo(
    () => (repoListRaw ? sortRepoViews(repoListRaw, 'name-asc') : []),
    [repoListRaw],
  );

  const {
    data: allPushes = [],
    isLoading: isLoadingPushes,
    error: pushesError,
  } = usePushesQuery({});

  const handleSearch = useCallback(
    (query: string) => {
      setSearchParams((prev) => applyActivityListUrlPatch(prev, { filter: query, page: 1 }), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setSearchParams((prev) => applyActivityListUrlPatch(prev, { page: nextPage }), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const repoDisplayIndex = useMemo(() => buildRepoDisplayIndex(registeredRepos), [registeredRepos]);

  const searchFiltered = useMemo(() => {
    let list = allPushes;
    if (repoIdFilter) {
      const r = registeredRepos.find((x) => x._id === repoIdFilter);
      if (r?.url) {
        const canon = canonicalRemoteUrl(r.url);
        list = list.filter((p) => canonicalRemoteUrl(p.url) === canon);
      }
    }
    return filterActivityBySearch(list, filter, repoDisplayIndex);
  }, [allPushes, filter, repoDisplayIndex, repoIdFilter, registeredRepos]);

  const tabCounts = useMemo(() => countActivitiesByTab(searchFiltered), [searchFiltered]);

  const rowsForActiveTab = useMemo(
    () => filterActivitiesForTab(searchFiltered, activeTab),
    [searchFiltered, activeTab],
  );

  useClientPagination(
    rowsForActiveTab,
    page,
    ACTIVITY_ITEMS_PER_PAGE,
    isLoadingPushes,
    (corrected) =>
      setSearchParams((p) => applyActivityListUrlPatch(p, { page: corrected }), { replace: true }),
  );

  return (
    <div className='w-full min-w-0'>
      <Stack direction='vertical' gap='none' padding='none'>
        {pushesError ? <Danger>{pushesError.message}</Danger> : null}
        {!pushesError ? (
          <>
            <PageHeader as='header' hasBorder>
              <PageHeader.TitleArea variant='large'>
                <PageHeader.Title as='h1' className='!font-semibold !tracking-tight'>
                  Activity
                </PageHeader.Title>
              </PageHeader.TitleArea>
              <PageHeader.Description>Push requests and their status.</PageHeader.Description>
              <PageHeader.Navigation>
                <Stack
                  direction='vertical'
                  gap='normal'
                  padding='none'
                  className='min-w-0 w-full pb-4'
                >
                  <div className='min-w-0 w-full'>
                    <ListFilterInput
                      value={filter}
                      onSearch={handleSearch}
                      placeholder='Search activity…'
                      ariaLabel='Search activity'
                      name='activity-filter'
                    />
                  </div>
                  <GitProxyUnderlineNav
                    aria-label='Filter activity by status'
                    className='min-w-0 w-full'
                  >
                    {ACTIVITY_TABS.map((tab) => {
                      const NavIcon = tab.NavIcon;
                      return (
                        <GitProxyUnderlineNav.Item
                          key={tab.id}
                          href='#'
                          leadingVisual={<NavIcon />}
                          counter={isLoadingPushes ? undefined : tabCounts[tab.id]}
                          aria-current={tab.id === activeTab ? 'page' : undefined}
                          onSelect={(
                            e:
                              | React.MouseEvent<HTMLAnchorElement>
                              | React.KeyboardEvent<HTMLAnchorElement>,
                          ) => {
                            e.preventDefault();
                            setSearchParams(
                              (prev) => applyActivityListUrlPatch(prev, { tab: tab.id, page: 1 }),
                              { replace: true },
                            );
                          }}
                        >
                          {tab.label}
                        </GitProxyUnderlineNav.Item>
                      );
                    })}
                  </GitProxyUnderlineNav>
                </Stack>
              </PageHeader.Navigation>
            </PageHeader>
            <div className='mt-4 min-w-0 w-full'>
              <PushesTable
                registeredRepos={registeredRepos}
                rows={rowsForActiveTab}
                isLoading={isLoadingPushes}
                currentPage={page}
                onPageChange={handlePageChange}
                activityTab={activeTab}
              />
            </div>
          </>
        ) : null}
      </Stack>
    </div>
  );
};

export default PushRequests;
