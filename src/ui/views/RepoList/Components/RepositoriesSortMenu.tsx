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

import React from 'react';
import { ActionMenu, ActionList } from '@primer/react';
import {
  ClockIcon,
  PersonIcon,
  PulseIcon,
  RepoPushIcon,
  SortAscIcon,
  SortDescIcon,
  TypographyIcon,
} from '@primer/octicons-react';

import type { RepoSortAxis, RepoSortField } from './repoSortField';
import {
  REPO_SORT_AXIS_LABEL,
  repoSortAxis,
  repoSortDirection,
  repoSortSetAxis,
  repoSortSetDirection,
} from './repoSortField';

export type { RepoSortAxis, RepoSortField } from './repoSortField';
export {
  DEFAULT_REPO_SORT,
  REPO_SORT_AXIS_LABEL,
  REPO_SORT_VALUES,
  isRepoSortField,
  repoSortCombine,
  repoSortDirection,
  repoSortAxis,
  repoSortSetAxis,
  repoSortSetDirection,
} from './repoSortField';

export interface RepositoriesSortMenuProps {
  sort: RepoSortField;
  onSortChange: (sort: RepoSortField) => void;
}

const axisMatchesSort = (axis: RepoSortAxis, sort: RepoSortField): boolean =>
  axis === 'relevance' ? sort === 'relevance' : repoSortAxis(sort) === axis;

const RepositoriesSortMenu = ({ sort, onSortChange }: RepositoriesSortMenuProps) => {
  const dir = repoSortDirection(sort);
  const ascending = dir === 'asc';
  const axisLabel = REPO_SORT_AXIS_LABEL[repoSortAxis(sort)];
  const ariaDir = ascending ? 'ascending' : 'descending';

  return (
    <ActionMenu>
      <ActionMenu.Button
        variant='invisible'
        size='small'
        leadingVisual={ascending ? SortAscIcon : SortDescIcon}
        aria-label={`Sort repositories: ${axisLabel}, ${ariaDir}`}
        className='max-w-[min(100%,18rem)] justify-end! px-2! text-(--fgColor-default)'
      >
        <span className='min-w-0 truncate text-right text-sm font-medium leading-normal [font-family:var(--fontStack-sansSerif)]'>
          {axisLabel}
        </span>
      </ActionMenu.Button>
      <ActionMenu.Overlay width='auto' align='end' side='outside-bottom' displayInViewport>
        <ActionList>
          <ActionList.Group selectionVariant='single'>
            <ActionList.Item
              selected={axisMatchesSort('relevance', sort)}
              onSelect={() => onSortChange('relevance')}
            >
              <ActionList.LeadingVisual>
                <PersonIcon />
              </ActionList.LeadingVisual>
              Relevance
            </ActionList.Item>
            <ActionList.Item
              selected={axisMatchesSort('activity', sort)}
              onSelect={() => onSortChange('activity')}
            >
              <ActionList.LeadingVisual>
                <PulseIcon />
              </ActionList.LeadingVisual>
              Activity
            </ActionList.Item>
            <ActionList.Item
              selected={axisMatchesSort('latestPendingReview', sort)}
              onSelect={() => onSortChange('latestPendingReview')}
            >
              <ActionList.LeadingVisual>
                <ClockIcon />
              </ActionList.LeadingVisual>
              Pending
            </ActionList.Item>
            <ActionList.Item
              selected={axisMatchesSort('name', sort)}
              onSelect={() => onSortChange(repoSortSetAxis(sort, 'name'))}
            >
              <ActionList.LeadingVisual>
                <TypographyIcon />
              </ActionList.LeadingVisual>
              Name
            </ActionList.Item>
            <ActionList.Item
              selected={axisMatchesSort('lastPushed', sort)}
              onSelect={() => onSortChange(repoSortSetAxis(sort, 'lastPushed'))}
            >
              <ActionList.LeadingVisual>
                <RepoPushIcon />
              </ActionList.LeadingVisual>
              Last pushed
            </ActionList.Item>
          </ActionList.Group>
          {sort !== 'relevance' && sort !== 'activity' && sort !== 'latestPendingReview' ? (
            <>
              <ActionList.Divider />
              <ActionList.Group selectionVariant='single'>
                <ActionList.Item
                  selected={ascending}
                  onSelect={() => onSortChange(repoSortSetDirection(sort, 'asc'))}
                >
                  <ActionList.LeadingVisual>
                    <SortAscIcon />
                  </ActionList.LeadingVisual>
                  Ascending
                </ActionList.Item>
                <ActionList.Item
                  selected={!ascending}
                  onSelect={() => onSortChange(repoSortSetDirection(sort, 'desc'))}
                >
                  <ActionList.LeadingVisual>
                    <SortDescIcon />
                  </ActionList.LeadingVisual>
                  Descending
                </ActionList.Item>
              </ActionList.Group>
            </>
          ) : null}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
};

export default RepositoriesSortMenu;
