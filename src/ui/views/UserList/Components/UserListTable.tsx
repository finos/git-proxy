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

import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { DataTable, createColumnHelper } from '@primer/react/experimental';
import { Label, Stack, Text } from '@primer/react';
import { PublicUser } from '../../../../db/types';
import ListFilterInput from '../../../components/ListFilterInput/ListFilterInput';
import Pagination from '../../../components/Pagination/Pagination';
import ActivityBadgeGroup from '../../../components/ActivityBadgeGroup/ActivityBadgeGroup';
import UsersSortMenu, { type UserSortField } from './UsersSortMenu';
import { userTableNameLinkClass } from '../../../components/UserTableNameCell/UserTableNameCell';

type UserTableRow = PublicUser & { id: string };

const columnHelper = createColumnHelper<UserTableRow>();

const usersTableHeader = (count: number): string => `${count} ${count === 1 ? 'user' : 'users'}`;

export interface UserListTableProps {
  users: PublicUser[];
  filterValue: string;
  onSearch: (query: string) => void;
  sort: UserSortField;
  onSortChange: (sort: UserSortField) => void;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export default function UserListTable(props: UserListTableProps): React.ReactElement {
  const tableRows: UserTableRow[] = useMemo(
    () => props.users.map((u) => ({ ...u, id: u.username })),
    [props.users],
  );

  const columns = useMemo(
    () => [
      columnHelper.column({
        id: 'user',
        header: () => (
          <span className='text-sm font-semibold text-(--fgColor-default)'>
            {usersTableHeader(props.totalItems)}
          </span>
        ),
        rowHeader: true,
        width: 'grow',
        minWidth: 'min(100%, 14rem)',
        renderCell: (row: UserTableRow) => {
          const label = row.displayName?.trim() || row.username;
          const profileHref = `/dashboard/user/${encodeURIComponent(row.username)}`;
          return (
            <Stack direction='vertical' gap='condensed' padding='none'>
              <Text as='div' size='medium' weight='semibold'>
                <Link
                  to={profileHref}
                  className={userTableNameLinkClass}
                  aria-label={`View profile for ${row.username}`}
                >
                  {label}
                </Link>
              </Text>
              {row.activity ? (
                <ActivityBadgeGroup activity={row.activity} hrefForStatus={() => profileHref} />
              ) : null}
            </Stack>
          );
        },
      }),
      columnHelper.column({
        id: 'role',
        header: () => null,
        width: 'auto',
        renderCell: (row: UserTableRow) =>
          row.title?.trim() ? (
            <span className='text-sm text-(--fgColor-default)'>{row.title}</span>
          ) : null,
      }),
      columnHelper.column({
        id: 'email',
        header: () => null,
        width: 'auto',
        renderCell: (row: UserTableRow) => (
          <a
            className='text-sm text-[#0969da] underline underline-offset-2 hover:text-[#0550ae]'
            href={`mailto:${row.email}`}
          >
            {row.email}
          </a>
        ),
      }),
      columnHelper.column({
        id: 'admin',
        header: () => (
          <div className='flex justify-end'>
            <UsersSortMenu sort={props.sort} onSortChange={props.onSortChange} />
          </div>
        ),
        align: 'end',
        width: 'auto',
        renderCell: (row: UserTableRow) =>
          row.admin ? (
            <Label variant='accent' size='small'>
              Admin
            </Label>
          ) : null,
      }),
    ],
    [props.onSortChange, props.sort, props.totalItems],
  );

  return (
    <div className='flex min-h-0 w-full min-w-0 flex-1 flex-col'>
      <div className='mb-4 flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-3'>
        <div className='min-w-0 w-full flex-1'>
          <ListFilterInput
            value={props.filterValue}
            onSearch={props.onSearch}
            placeholder='Search users…'
            ariaLabel='Search users'
            name='users-filter'
          />
        </div>
      </div>
      <div className='overflow-hidden rounded-md border border-(--borderColor-default,#d0d7de)'>
        <DataTable<UserTableRow> cellPadding='normal' columns={columns} data={tableRows} />
      </div>
      <div className='mt-auto shrink-0'>
        <Pagination
          currentPage={props.currentPage}
          totalItems={props.totalItems}
          itemsPerPage={props.itemsPerPage}
          onPageChange={props.onPageChange}
        />
      </div>
    </div>
  );
}
