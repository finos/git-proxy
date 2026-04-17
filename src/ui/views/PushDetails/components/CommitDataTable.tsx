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
import { DateTime } from 'luxon';
import { Text } from '@primer/react';
import { DataTable, createColumnHelper } from '@primer/react/experimental';
import { CommitData } from '../../../../proxy/processors/types';
import UserIdentity from '../../../components/UserIdentity/UserIdentity';

/** Match {@link PushesTable} body typography. */
const mutedMetaClass = 'm-0 min-w-0 text-sm font-normal text-[var(--fgColor-muted)]';

const authorNameClass =
  'm-0 min-w-0 max-w-[10rem] truncate text-sm font-normal text-[var(--fgColor-default)]';

const commitMessageClass =
  'm-0 min-w-0 text-sm font-normal leading-snug text-[var(--fgColor-default)]';

/** Match {@link PushDetails} `RemoteCommitSha` link styling. */
const repoHeaderLinkClass =
  '!text-[var(--fgColor-accent)] no-underline font-semibold hover:underline';
const commitShaLinkClass = `${repoHeaderLinkClass} break-all font-mono text-sm`;
const commitShaCodeClass =
  'break-all rounded-sm bg-[var(--bgColor-muted)] px-1.5 py-0.5 font-mono text-sm text-[var(--fgColor-default)]';

/**
 * Table chrome: same borders and vertical alignment as activity list.
 * Row-header cells are `tbody th` (see `rowHeader` on the timestamp column); they need the same
 * `items-start` override as `td` because Primer cells use `display:flex; align-items:center`.
 */
const commitTableShellClass =
  '[&_thead_th]:border-b [&_thead_th]:border-[var(--borderColor-muted)] [&_tbody_td]:align-top [&_tbody_td]:!items-start [&_tbody_td]:border-b [&_tbody_td]:border-[var(--borderColor-muted)] [&_tbody_th]:align-top [&_tbody_th]:!items-start [&_tbody_th]:border-b [&_tbody_th]:border-[var(--borderColor-muted)]';

type CommitTableRow = CommitData & { id: string };

const columnHelper = createColumnHelper<CommitTableRow>();

/**
 * Legacy pushes may omit `sha` on each commit. For a single-commit range, the tip hash is
 * `commitTo` on the action (passed as `tipCommitSha`).
 */
function resolveCommitDisplaySha(
  row: CommitTableRow,
  commitData: CommitData[],
  tipCommitSha: string | undefined,
): string | undefined {
  if (row.sha) {
    return row.sha;
  }
  if (commitData.length === 1 && tipCommitSha) {
    return tipCommitSha;
  }
  return undefined;
}

function columnHeader(label: string): () => React.ReactElement {
  function Header(): React.ReactElement {
    return (
      <Text
        as='span'
        size='small'
        weight='semibold'
        className='m-0 text-[var(--fgColor-muted)] uppercase tracking-wide'
      >
        {label}
      </Text>
    );
  }
  Header.displayName = `CommitColumnHeader(${label})`;
  return Header;
}

interface CommitDataTableProps {
  commitData: CommitData[];
  repoWebUrl: string;
  tipCommitSha: string | undefined;
  tipOnRemote: boolean;
}

const CommitDataTable = ({
  commitData,
  repoWebUrl,
  tipCommitSha,
  tipOnRemote,
}: CommitDataTableProps) => {
  const tableRows: CommitTableRow[] = useMemo(
    () =>
      commitData.map((c, i) => ({
        ...c,
        id: `${c.commitTimestamp || 'unknown'}-${i}`,
      })),
    [commitData],
  );

  const columns = useMemo(
    () => [
      columnHelper.column({
        id: 'timestamp',
        header: columnHeader('Timestamp'),
        rowHeader: true,
        minWidth: 'min(100%, 10rem)',
        width: 'auto',
        renderCell: (row) => {
          const ts = row.commitTimestamp;
          if (!ts) {
            return (
              <Text as='span' className={`${mutedMetaClass} text-left`}>
                —
              </Text>
            );
          }
          const m = DateTime.fromSeconds(Number(ts));
          const primary = `${m.toLocaleString(DateTime.DATE_MED)} ${m.toLocaleString(DateTime.TIME_SIMPLE)}`;
          return (
            <Text
              as='span'
              className={`${mutedMetaClass} w-full text-left whitespace-nowrap`}
              title={m.toISO()}
            >
              {primary}
            </Text>
          );
        },
      }),
      columnHelper.column({
        id: 'sha',
        header: columnHeader('SHA'),
        minWidth: 'min(100%, 14rem)',
        width: 'auto',
        renderCell: (row) => {
          const sha = resolveCommitDisplaySha(row, commitData, tipCommitSha);
          if (!sha) {
            return (
              <Text as='span' className={`${mutedMetaClass} font-mono text-left`}>
                —
              </Text>
            );
          }
          const canLink = tipOnRemote && tipCommitSha === sha;
          if (canLink) {
            return (
              <a
                href={`${repoWebUrl}/commit/${sha}`}
                rel='noreferrer'
                target='_blank'
                className={commitShaLinkClass}
              >
                {sha}
              </a>
            );
          }
          return (
            <code className={`${commitShaCodeClass} text-left`} title={sha}>
              {sha}
            </code>
          );
        },
      }),
      columnHelper.column({
        id: 'committer',
        header: columnHeader('Committer'),
        minWidth: 'min(100%, 9rem)',
        width: 'auto',
        renderCell: (row) => (
          <div className='min-w-0'>
            <UserIdentity
              name={row.committer}
              email={row.committerEmail}
              className='flex min-w-0 flex-col gap-0.5'
              nameClassName={`${authorNameClass} text-left`}
              emailClassName={`${mutedMetaClass} break-all text-left`}
              emptyClassName={`${mutedMetaClass} text-left`}
            />
          </div>
        ),
      }),
      columnHelper.column({
        id: 'author',
        header: columnHeader('Author'),
        minWidth: 'min(100%, 9rem)',
        width: 'auto',
        renderCell: (row) => (
          <div className='min-w-0'>
            <UserIdentity
              name={row.author}
              email={row.authorEmail}
              className='flex min-w-0 flex-col gap-0.5'
              nameClassName={`${authorNameClass} text-left`}
              emailClassName={`${mutedMetaClass} break-all text-left`}
              emptyClassName={`${mutedMetaClass} text-left`}
            />
          </div>
        ),
      }),
      columnHelper.column({
        id: 'message',
        header: columnHeader('Message'),
        width: 'grow',
        minWidth: 'min(100%, 12rem)',
        renderCell: (row) => (
          <Text
            as='div'
            className={`${commitMessageClass} min-w-0 w-full whitespace-pre-wrap break-words`}
          >
            {row.message}
          </Text>
        ),
      }),
    ],
    [commitData, repoWebUrl, tipCommitSha, tipOnRemote],
  );

  if (commitData.length === 0) {
    return (
      <Text
        as='p'
        size='medium'
        weight='normal'
        className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
      >
        No commits found for this push.
      </Text>
    );
  }

  return (
    <div
      className={`${commitTableShellClass} overflow-x-auto rounded-md border border-[var(--borderColor-default)]`}
    >
      <DataTable<CommitTableRow> cellPadding='condensed' columns={columns} data={tableRows} />
    </div>
  );
};

export default CommitDataTable;
