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

import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { DateTime } from 'luxon';
import { useNavigate } from 'react-router';
import { GitBranchIcon, GitCommitIcon } from '@primer/octicons-react';
import { Link, Spinner, Text } from '@primer/react';
import { DataTable, createColumnHelper } from '@primer/react/experimental';
import Pagination from '../../../components/Pagination/Pagination';
import UserIdentity from '../../../components/UserIdentity/UserIdentity';
import { PushActionView, RepoView } from '../../../types';
import { trimPrefixRefsHeads } from '../../../../db/helper';
import { canonicalRemoteUrl } from '../../../utils/parseGitRemoteUrl';
import type { ActivityTab } from '../activityListQuery';
import { buildRepoDisplayIndex, resolveActivityRepoDisplay } from '../activityTabFilters';

const mutedMetaClass = 'm-0 min-w-0 text-sm font-normal text-[var(--fgColor-muted)]';

const commitMessageClass =
  'm-0 min-w-0 text-sm font-normal leading-snug text-[var(--fgColor-default)]';

const repoMetaRowClass =
  'flex min-w-0 flex-wrap items-center gap-x-2 text-sm font-normal leading-5 text-[var(--fgColor-muted)]';

const repoNameSegmentClass =
  'inline-flex min-h-5 min-w-0 max-w-full items-center font-semibold text-[var(--fgColor-default)]';

const authorNameClass =
  'm-0 min-w-0 max-w-[10rem] truncate text-sm font-normal text-[var(--fgColor-default)]';

/** Body rows from Primer DataTable (`TableRow` adds literal class `TableRow`). */
const activityTableBodyRowSelector = 'tbody tr.TableRow';

const activityTableShellRowClass =
  '[&_thead_th]:border-b [&_thead_th]:border-[var(--borderColor-muted)] [&_tbody_tr.TableRow]:cursor-pointer [&_tbody_tr.TableRow]:[-webkit-tap-highlight-color:transparent] [&_tbody_tr.TableRow:hover]:bg-[var(--control-transparent-bgColor-hover)] [&_tbody_tr.TableRow:focus-visible]:outline-none [&_tbody_tr.TableRow:focus-visible]:ring-2 [&_tbody_tr.TableRow:focus-visible]:ring-[var(--fgColor-accent)] [&_tbody_tr.TableRow:focus-visible]:ring-inset [&_tbody_td]:align-top [&_tbody_td]:!items-start [&_tbody_td]:border-b [&_tbody_td]:border-[var(--borderColor-muted)] [&_tbody_th]:align-top [&_tbody_th]:!items-start [&_tbody_th]:border-b [&_tbody_th]:border-[var(--borderColor-muted)]';

function githubColumnHeader(label: string): () => React.ReactElement {
  function GithubColumnHeader(): React.ReactElement {
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
  GithubColumnHeader.displayName = `GithubColumnHeader(${label})`;
  return GithubColumnHeader;
}

function pushStatusLabel(row: PushActionView): { label: string; className: string } {
  if (row.error) return { label: 'Error', className: 'text-[var(--fgColor-danger)]' };
  if (row.rejected) return { label: 'Rejected', className: 'text-[var(--fgColor-danger)]' };
  if (row.canceled) return { label: 'Canceled', className: 'text-[var(--fgColor-muted)]' };
  if (row.authorised) return { label: 'Approved', className: 'text-[var(--fgColor-success)]' };
  if (row.blocked) return { label: 'Pending', className: 'text-[var(--fgColor-attention)]' };
  return { label: '—', className: 'text-[var(--fgColor-muted)]' };
}

function primaryAuthorLine(row: PushActionView): { label: string; title: string } {
  const head = row.commitData?.[0];
  const author = head?.author?.trim() ?? '';
  const authorEmail = head?.authorEmail?.trim() ?? '';
  const committer = head?.committer?.trim() ?? '';
  const committerEmail = head?.committerEmail?.trim() ?? '';

  if (author) {
    const title =
      authorEmail && author !== authorEmail ? `${author} <${authorEmail}>` : authorEmail || author;
    return { label: author, title };
  }
  if (authorEmail) {
    return { label: authorEmail, title: authorEmail };
  }
  if (committer) {
    const title =
      committerEmail && committer !== committerEmail
        ? `${committer} <${committerEmail}>`
        : committerEmail || committer;
    return { label: committer, title };
  }
  if (committerEmail) {
    return { label: committerEmail, title: committerEmail };
  }
  return { label: '', title: '' };
}

/** Prefer API `displayName`; otherwise derive a readable label from `email` / `reviewerEmail` local part. */
function reviewerDisplayNameFromReviewer(
  reviewer:
    | {
        displayName?: string | null;
        email?: string;
        reviewerEmail?: string;
      }
    | undefined,
): string | undefined {
  const dn = reviewer?.displayName?.trim();
  if (dn) return dn;
  const addr = reviewer?.email?.trim() || reviewer?.reviewerEmail?.trim();
  if (!addr?.includes('@')) return undefined;
  const local = addr.split('@')[0] ?? '';
  if (!local) return undefined;
  return local
    .split(/[._-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function primaryAuthorFields(row: PushActionView): { name: string; email: string } {
  const head = row.commitData?.[0];
  const author = head?.author?.trim() ?? '';
  const authorEmail = head?.authorEmail?.trim() ?? '';
  const committer = head?.committer?.trim() ?? '';
  const committerEmail = head?.committerEmail?.trim() ?? '';

  if (author) {
    return { name: author, email: authorEmail };
  }
  if (authorEmail) {
    return { name: '', email: authorEmail };
  }
  if (committer) {
    return { name: committer, email: committerEmail };
  }
  if (committerEmail) {
    return { name: '', email: committerEmail };
  }
  return { name: '', email: '' };
}

type PushTableRow = PushActionView & { id: string };

const columnHelper = createColumnHelper<PushTableRow>();

const ITEMS_PER_PAGE = 100;

interface PushesTableProps {
  /** Registered repositories (same catalog as the repos list) for matching display names. */
  registeredRepos?: RepoView[];
  /** Rows for the active tab (already filtered by search). */
  rows: PushActionView[];
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** When true, appends a Status column after Commit (embedded lists without `activityTab`). */
  showStatus?: boolean;
  /** Activity filter tab; drives which reviewer/status columns are shown. Omit for embedded tables (show all relevant columns). */
  activityTab?: ActivityTab;
}

const PushesTable = ({
  registeredRepos = [],
  rows,
  isLoading,
  currentPage,
  onPageChange,
  showStatus = false,
  activityTab,
}: PushesTableProps) => {
  const navigate = useNavigate();

  const showApprovedBy = activityTab == null || activityTab === 'all' || activityTab === 'approved';
  const showRejectedBy = activityTab == null || activityTab === 'all' || activityTab === 'rejected';
  const showStatusColumn = activityTab == null ? showStatus : activityTab === 'all';

  const openPush = useCallback(
    (pushId: string) => {
      navigate(`/dashboard/push/${pushId}`);
    },
    [navigate],
  );

  const tableShellRef = useRef<HTMLDivElement>(null);

  const repoDisplayIndex = useMemo(() => buildRepoDisplayIndex(registeredRepos), [registeredRepos]);

  const repoIdByCanonicalUrl = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of registeredRepos) {
      const url = r.url?.trim();
      if (!url) continue;
      const key = canonicalRemoteUrl(url);
      if (!key || !r._id) continue;
      m.set(key, r._id);
    }
    return m;
  }, [registeredRepos]);

  const maxPage = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const effectivePage = Math.min(currentPage, maxPage);

  const indexOfLastItem = effectivePage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = rows.slice(indexOfFirstItem, indexOfLastItem);

  const tableRows: PushTableRow[] = useMemo(
    () => currentItems.map((row) => ({ ...row, id: row.id })),
    [currentItems],
  );

  useLayoutEffect(() => {
    const root = tableShellRef.current;
    if (!root || tableRows.length === 0) {
      return;
    }

    const trs = root.querySelectorAll<HTMLTableRowElement>(activityTableBodyRowSelector);
    const disposers: Array<() => void> = [];

    trs.forEach((tr, index) => {
      const row = tableRows[index];
      if (!row) {
        return;
      }

      const activate = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('a, button')) {
          return;
        }
        openPush(row.id);
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      };

      tr.tabIndex = 0;
      tr.setAttribute('aria-label', `Open activity ${row.id}`);

      tr.addEventListener('click', activate);
      tr.addEventListener('keydown', onKeyDown);

      disposers.push(() => {
        tr.removeEventListener('click', activate);
        tr.removeEventListener('keydown', onKeyDown);
        tr.removeAttribute('tabindex');
        tr.removeAttribute('aria-label');
      });
    });

    return () => {
      disposers.forEach((d) => d());
    };
  }, [tableRows, openPush]);

  const columns = useMemo(
    () => [
      columnHelper.column({
        id: 'date',
        header: githubColumnHeader('Date'),
        minWidth: 'min(100%, 9rem)',
        width: 'auto',
        renderCell: (row) => {
          const commitTimestamp = row.commitData?.[0]?.commitTimestamp;
          if (!commitTimestamp) {
            return (
              <Text as='span' className={`${mutedMetaClass} text-left`}>
                —
              </Text>
            );
          }
          const m = DateTime.fromSeconds(Number(commitTimestamp));
          const primary = `${m.toLocaleString(DateTime.DATE_MED)} ${m.toFormat('HH:mm')}`;
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
        id: 'author',
        header: githubColumnHeader('Author'),
        minWidth: 'min(100%, 9rem)',
        width: 'auto',
        renderCell: (row) => {
          const { name, email } = primaryAuthorFields(row);
          const { title } = primaryAuthorLine(row);
          if (!name && !email) {
            return (
              <Text as='span' className={`${authorNameClass} text-[var(--fgColor-muted)]`}>
                —
              </Text>
            );
          }
          return (
            <div className='min-w-0' onClick={(e) => e.stopPropagation()}>
              <UserIdentity
                name={name || undefined}
                email={email || undefined}
                title={title || undefined}
                className='flex min-w-0 flex-col gap-0.5'
                nameClassName={`${authorNameClass} text-left`}
                emailClassName={`${mutedMetaClass} break-all text-left`}
                emptyClassName={`${authorNameClass} text-[var(--fgColor-muted)]`}
              />
            </div>
          );
        },
      }),
      ...(showApprovedBy
        ? [
            columnHelper.column({
              id: 'approvedBy',
              header: githubColumnHeader('Approved by'),
              minWidth: 'min(100%, 8rem)',
              width: 'auto',
              renderCell: (row) => {
                const username = row.authorised
                  ? row.attestation?.reviewer?.username?.trim()
                  : undefined;
                const approvedByName = row.attestation?.reviewer?.displayName?.trim() || undefined;
                if (!username) {
                  return (
                    <Text
                      as='span'
                      className={`${authorNameClass} text-left text-[var(--fgColor-muted)]`}
                    >
                      —
                    </Text>
                  );
                }
                return (
                  <div className='min-w-0' onClick={(e) => e.stopPropagation()}>
                    <UserIdentity
                      username={username}
                      name={approvedByName}
                      className='flex min-w-0 flex-col gap-0.5'
                      nameClassName={`${authorNameClass} text-left`}
                      emailClassName={`${mutedMetaClass} break-all text-left`}
                      emptyClassName={`${authorNameClass} text-[var(--fgColor-muted)]`}
                    />
                  </div>
                );
              },
            }),
          ]
        : []),
      ...(showRejectedBy
        ? [
            columnHelper.column({
              id: 'rejectedBy',
              header: githubColumnHeader('Rejected by'),
              minWidth: 'min(100%, 8rem)',
              width: 'auto',
              renderCell: (row) => {
                const reviewer = row.rejection?.reviewer;
                const username = row.rejected ? reviewer?.username?.trim() : undefined;
                const rejectedByName = reviewerDisplayNameFromReviewer(reviewer);
                const reviewerEmail =
                  reviewer?.email?.trim() || reviewer?.reviewerEmail?.trim() || undefined;
                const title =
                  rejectedByName && reviewerEmail
                    ? `${rejectedByName} <${reviewerEmail}>`
                    : reviewerEmail || rejectedByName || username || undefined;
                if (!username) {
                  return (
                    <Text
                      as='span'
                      className={`${authorNameClass} text-left text-[var(--fgColor-muted)]`}
                    >
                      —
                    </Text>
                  );
                }
                return (
                  <div className='min-w-0' onClick={(e) => e.stopPropagation()}>
                    <UserIdentity
                      username={username}
                      name={rejectedByName}
                      email={reviewerEmail}
                      title={title}
                      className='flex min-w-0 flex-col gap-0.5'
                      nameClassName={`${authorNameClass} text-left`}
                      emailClassName={`${mutedMetaClass} break-all text-left`}
                      emptyClassName={`${authorNameClass} text-[var(--fgColor-muted)]`}
                    />
                  </div>
                );
              },
            }),
          ]
        : []),
      columnHelper.column({
        id: 'commit',
        header: githubColumnHeader('Commit'),
        width: 'grow',
        minWidth: 'min(100%, 14rem)',
        renderCell: (row) => {
          const head = row.commitData?.[0];
          const full = head?.message?.trim() ?? '';
          const repoLabel = resolveActivityRepoDisplay(row, repoDisplayIndex);
          const pushKey = canonicalRemoteUrl(row.url);
          const repoId = pushKey ? repoIdByCanonicalUrl.get(pushKey) : undefined;
          const branchRaw = trimPrefixRefsHeads(row.branch ?? '').trim();
          const shaFull = row.commitTo?.trim() ?? '';
          const shortSha = shaFull.length >= 7 ? shaFull.substring(0, 7) : shaFull;
          const n = row.commitData?.length ?? 0;
          const batchHint = n > 1 ? `${n} commits` : '';
          const metaTitle = row.url ? `${repoLabel} — ${row.url}` : repoLabel;
          const branchShaTitle =
            branchRaw && shaFull ? `${branchRaw} · ${shaFull}` : branchRaw || shaFull || undefined;

          return (
            <div className='flex min-w-0 flex-col gap-0.5'>
              <Text
                as='div'
                className={repoMetaRowClass}
                title={branchShaTitle || metaTitle || undefined}
                aria-label={
                  branchRaw && shortSha
                    ? `Branch ${branchRaw}, commit ${shortSha}`
                    : branchRaw
                      ? `Branch ${branchRaw}`
                      : shortSha
                        ? `Commit ${shortSha}`
                        : `Repository ${repoLabel}`
                }
              >
                <span className={`${repoNameSegmentClass} shrink`}>
                  {repoId ? (
                    <Link
                      href={`/dashboard/repo/${repoId}`}
                      className='min-w-0 truncate !text-[var(--fgColor-accent)] no-underline hover:underline'
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      {repoLabel}
                    </Link>
                  ) : (
                    <span className='min-w-0 truncate' title={metaTitle}>
                      {repoLabel}
                    </span>
                  )}
                </span>
                {branchRaw ? (
                  <span className='inline-flex min-h-5 min-w-0 max-w-full items-center gap-1'>
                    <GitBranchIcon size={16} className='shrink-0 self-center' aria-hidden />
                    <span className='min-w-0 truncate'>{branchRaw}</span>
                  </span>
                ) : null}
                {shortSha ? (
                  <span className='inline-flex min-h-5 shrink-0 items-center gap-0.5'>
                    <GitCommitIcon size={16} className='shrink-0 self-center' aria-hidden />
                    <span className='font-mono tabular-nums leading-5'>({shortSha})</span>
                  </span>
                ) : null}
              </Text>
              <Text
                as='div'
                title={full || undefined}
                className={`${commitMessageClass} line-clamp-2 break-words`}
              >
                {full || 'No commit message'}
              </Text>
              {batchHint ? (
                <Text as='div' className={`${mutedMetaClass} truncate`} title={batchHint}>
                  {batchHint}
                </Text>
              ) : null}
            </div>
          );
        },
      }),
      ...(showStatusColumn
        ? [
            columnHelper.column({
              id: 'status',
              header: githubColumnHeader('Status'),
              minWidth: 'min(100%, 7rem)',
              width: 'auto',
              renderCell: (row) => {
                const { label, className } = pushStatusLabel(row);
                return (
                  <Text as='span' className={`${mutedMetaClass} ${className} text-left`}>
                    {label}
                  </Text>
                );
              },
            }),
          ]
        : []),
    ],
    [repoDisplayIndex, repoIdByCanonicalUrl, showApprovedBy, showRejectedBy, showStatusColumn],
  );

  if (isLoading) {
    return (
      <div className='flex w-full min-w-0 items-center gap-2'>
        <Spinner />
        <Text size='large'>Loading activity…</Text>
      </div>
    );
  }

  return (
    <div className='w-full min-w-0'>
      <div
        ref={tableShellRef}
        className={`${activityTableShellRowClass} overflow-x-auto rounded-md border border-[var(--borderColor-default)]`}
      >
        <DataTable<PushTableRow> cellPadding='condensed' columns={columns} data={tableRows} />
      </div>
      <div className='mt-auto shrink-0'>
        <Pagination
          itemsPerPage={ITEMS_PER_PAGE}
          totalItems={rows.length}
          currentPage={effectivePage}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
};

export default PushesTable;
