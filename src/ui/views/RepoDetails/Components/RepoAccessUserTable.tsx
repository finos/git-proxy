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
import { IconButton } from '@primer/react';
import { TrashIcon } from '@primer/octicons-react';
import { DataTable, createColumnHelper } from '@primer/react/experimental';
import AddUser from './AddUser';
import UserTableNameCell from '../../../components/UserTableNameCell/UserTableNameCell';
import { PublicUser } from '../../../../db/types';

type AccessRow = { id: string; username: string };

type RepoAccessAction = 'authorise' | 'push';

const columnHelper = createColumnHelper<AccessRow>();

function accessMemberTableHeader(count: number, memberLabelPlural: string): string {
  const noun = count === 1 ? memberLabelPlural.replace(/s$/, '') : memberLabelPlural;
  return `${count} ${noun}`;
}

function sortAccessUsernames(
  names: string[],
  userByUsername: Record<string, PublicUser>,
): string[] {
  const next = [...names];
  next.sort((a, b) => {
    const labelA = userByUsername[a]?.displayName?.trim() || a;
    const labelB = userByUsername[b]?.displayName?.trim() || b;
    const cmp = labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
  return next;
}

export interface RepoAccessUserTableProps {
  usernames: string[];
  isAdmin: boolean;
  onRemove: (username: string) => void;
  ariaLabel: string;
  memberLabelPlural: string;
  repoId?: string;
  accessAction?: RepoAccessAction;
  refreshFn?: () => void | Promise<void>;
  userByUsername?: Record<string, PublicUser>;
  sessionUser: PublicUser | null;
  authLoading: boolean;
}

export default function RepoAccessUserTable(props: RepoAccessUserTableProps): React.ReactElement {
  const {
    usernames,
    isAdmin,
    memberLabelPlural,
    repoId,
    accessAction,
    refreshFn,
    userByUsername = {},
    sessionUser,
    authLoading,
  } = props;

  const tableRows: AccessRow[] = useMemo(() => {
    const sorted = sortAccessUsernames(usernames, userByUsername);
    return sorted.map((u) => ({ id: u, username: u }));
  }, [usernames, userByUsername]);

  const n = tableRows.length;
  const countHeader = accessMemberTableHeader(n, memberLabelPlural);

  const showAddInHeader =
    isAdmin &&
    Boolean(repoId) &&
    (accessAction === 'authorise' || accessAction === 'push') &&
    typeof refreshFn === 'function';

  const columns = useMemo(() => {
    const mainCol = columnHelper.column({
      id: 'members',
      header: () => (
        <span className='text-sm font-semibold text-(--fgColor-default)'>{countHeader}</span>
      ),
      rowHeader: true,
      width: 'grow',
      minWidth: 'min(100%, 20rem)',
      renderCell: (row: AccessRow) => (
        <UserTableNameCell
          username={row.username}
          profile={userByUsername[row.username]}
          sessionUser={sessionUser}
          authLoading={authLoading}
        />
      ),
    });

    if (!isAdmin) {
      return [mainCol];
    }

    const actionsCol = columnHelper.column({
      id: 'actions',
      header: () => (
        <div className='flex justify-end'>
          {showAddInHeader ? (
            <AddUser
              repoId={repoId!}
              type={accessAction!}
              refreshFn={refreshFn!}
              excludedUsernames={usernames}
            />
          ) : null}
        </div>
      ),
      align: 'end',
      width: 'auto',
      renderCell: (row: AccessRow) => (
        <IconButton
          icon={TrashIcon}
          aria-label={`Remove ${row.username}`}
          variant='danger'
          onClick={() => props.onRemove(row.username)}
        />
      ),
    });

    return [mainCol, actionsCol];
  }, [
    accessAction,
    authLoading,
    countHeader,
    isAdmin,
    props.onRemove,
    sessionUser,
    userByUsername,
    refreshFn,
    repoId,
    showAddInHeader,
    usernames,
  ]);

  return (
    <div
      className='overflow-hidden rounded-md border border-(--borderColor-default,#d0d7de)'
      role='region'
      aria-label={props.ariaLabel}
    >
      <DataTable<AccessRow> cellPadding='normal' columns={columns} data={tableRows} />
    </div>
  );
}
