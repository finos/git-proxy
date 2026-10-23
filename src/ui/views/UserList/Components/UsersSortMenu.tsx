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
import { PulseIcon, SortAscIcon, SortDescIcon, TypographyIcon } from '@primer/octicons-react';

import type { UserSortField } from './userSortField';
import {
  USER_SORT_ACTIVITY_LABEL,
  USER_SORT_NAME_LABEL,
  userSortDirection,
  userSortSetDirection,
} from './userSortField';

export type { UserSortField } from './userSortField';
export {
  DEFAULT_USER_SORT,
  USER_SORT_NAME_LABEL,
  isUserSortField,
  userSortDirection,
  userSortSetDirection,
} from './userSortField';

export interface UsersSortMenuProps {
  sort: UserSortField;
  onSortChange: (sort: UserSortField) => void;
}

const UsersSortMenu = ({ sort, onSortChange }: UsersSortMenuProps) => {
  const isActivitySort = sort === 'activity';
  const dir = userSortDirection(sort);
  const ascending = dir === 'asc';

  const currentLabel = isActivitySort ? USER_SORT_ACTIVITY_LABEL : USER_SORT_NAME_LABEL;
  const ariaLabel = isActivitySort
    ? `Sort users: ${USER_SORT_ACTIVITY_LABEL}, most active first`
    : `Sort users: ${USER_SORT_NAME_LABEL}, ${ascending ? 'ascending' : 'descending'}`;

  return (
    <ActionMenu>
      <ActionMenu.Button
        variant='invisible'
        size='small'
        leadingVisual={isActivitySort ? PulseIcon : ascending ? SortAscIcon : SortDescIcon}
        aria-label={ariaLabel}
        className='max-w-[min(100%,18rem)] justify-end! px-2! text-(--fgColor-default)'
      >
        <span className='min-w-0 truncate text-right text-sm font-semibold'>{currentLabel}</span>
      </ActionMenu.Button>
      <ActionMenu.Overlay width='auto' align='end' side='outside-bottom' displayInViewport>
        <ActionList>
          <ActionList.Group selectionVariant='single'>
            <ActionList.Item
              selected={!isActivitySort}
              onSelect={() => onSortChange(userSortSetDirection(ascending ? 'asc' : 'desc'))}
            >
              <ActionList.LeadingVisual>
                <TypographyIcon />
              </ActionList.LeadingVisual>
              {USER_SORT_NAME_LABEL}
            </ActionList.Item>
            <ActionList.Item selected={isActivitySort} onSelect={() => onSortChange('activity')}>
              <ActionList.LeadingVisual>
                <PulseIcon />
              </ActionList.LeadingVisual>
              {USER_SORT_ACTIVITY_LABEL}
            </ActionList.Item>
          </ActionList.Group>
          <ActionList.Divider />
          <ActionList.Group selectionVariant='single'>
            <ActionList.Item
              selected={!isActivitySort && ascending}
              onSelect={() => onSortChange(userSortSetDirection('asc'))}
            >
              <ActionList.LeadingVisual>
                <SortAscIcon />
              </ActionList.LeadingVisual>
              Ascending
            </ActionList.Item>
            <ActionList.Item
              selected={!isActivitySort && !ascending}
              onSelect={() => onSortChange(userSortSetDirection('desc'))}
            >
              <ActionList.LeadingVisual>
                <SortDescIcon />
              </ActionList.LeadingVisual>
              Descending
            </ActionList.Item>
          </ActionList.Group>
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
};

export default UsersSortMenu;
