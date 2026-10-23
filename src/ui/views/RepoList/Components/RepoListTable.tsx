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
import { DataTable, createColumnHelper } from '@primer/react/experimental';
import { RepoView } from '../../../types';
import ListFilterInput from '../../../components/ListFilterInput/ListFilterInput';
import RepositoriesSortMenu, { type RepoSortField } from './RepositoriesSortMenu';
import Pagination from '../../../components/Pagination/Pagination';
import { RepositoryActionCell, RepositoryMainCell } from './RepoOverview';

type RepoTableRow = RepoView & { id: string };

const columnHelper = createColumnHelper<RepoTableRow>();

const repositoryTableHeader = (count: number): string =>
  `${count} ${count === 1 ? 'repository' : 'repositories'}`;

export interface RepoListTableProps {
  repos: RepoView[];
  newRepoAction: React.ReactNode | null;
  filterValue: string;
  onSearch: (query: string) => void;
  sort: RepoSortField;
  onSortChange: (sort: RepoSortField) => void;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export default function RepoListTable(props: RepoListTableProps): React.ReactElement {
  const tableRows: RepoTableRow[] = useMemo(
    () =>
      props.repos
        .filter((r): r is RepoView & { _id: string } => Boolean(r.url && r._id))
        .map((r) => ({ ...r, id: r._id, proxyURL: r.proxyURL || '' })),
    [props.repos],
  );

  const columns = useMemo(
    () => [
      columnHelper.column({
        id: 'repository',
        header: () => (
          <span className='text-sm font-medium leading-normal text-(--fgColor-default) [font-family:var(--fontStack-sansSerif)]'>
            {repositoryTableHeader(props.totalItems)}
          </span>
        ),
        rowHeader: true,
        width: 'grow',
        minWidth: 'min(100%, 20rem)',
        renderCell: (row: RepoTableRow) => <RepositoryMainCell repo={row} />,
      }),
      columnHelper.column({
        id: 'actions',
        header: () => (
          <div className='flex justify-end'>
            <RepositoriesSortMenu sort={props.sort} onSortChange={props.onSortChange} />
          </div>
        ),
        align: 'end',
        width: 'auto',
        renderCell: (row: RepoTableRow) => <RepositoryActionCell repo={row} />,
      }),
    ],
    [props.onSortChange, props.sort, props.totalItems],
  );

  return (
    <div className='w-full min-w-0'>
      <div className='mb-4 flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-3'>
        <div className='min-w-0 w-full flex-1'>
          <ListFilterInput value={props.filterValue} onSearch={props.onSearch} />
        </div>
        {props.newRepoAction ? (
          <div className='flex shrink-0 items-center'>{props.newRepoAction}</div>
        ) : null}
      </div>
      <div className='overflow-hidden rounded-md border border-(--borderColor-default,#d0d7de)'>
        <DataTable<RepoTableRow> cellPadding='normal' columns={columns} data={tableRows} />
      </div>
      <Pagination
        currentPage={props.currentPage}
        totalItems={props.totalItems}
        itemsPerPage={props.itemsPerPage}
        onPageChange={props.onPageChange}
      />
    </div>
  );
}
