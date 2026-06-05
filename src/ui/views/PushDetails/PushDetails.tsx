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

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { DateTime } from 'luxon';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Banner, Button, PageHeader, Spinner, Stack, StateLabel, Text } from '@primer/react';
import { GitProxyUnderlinePanels } from '../../components/GitProxyUnderlineTabs';
import type { StateLabelProps } from '@primer/react';
import {
  ArrowRightIcon,
  FileDiffIcon,
  GitBranchIcon,
  GitCommitIcon,
  WorkflowIcon,
} from '@primer/octicons-react';
import CommitDataTable from './components/CommitDataTable';
import Diff from './components/Diff';
import StepsTimeline from './components/StepsTimeline';
import Attestation from './components/Attestation';
import AttestationInfo from './components/AttestationInfo';
import RejectionInfo from './components/RejectionInfo';
import Reject from './components/Reject';
import { authorisePush, rejectPush, cancelPush } from '../../services/git-push';
import type { ServiceResult } from '../../services/errors';
import { PushActionView, RepoView } from '../../types';
import { trimPrefixRefsHeads, trimTrailingDotGit } from '../../../db/helper';
import { sortRepoViews } from '../../services/repo';
import { useRepoViewsListQuery } from '../../query/useRepoViewsListQuery';
import { usePushQuery } from '../../query/usePushQuery';
import { usePushPermissionsQuery } from '../../query/usePushPermissionsQuery';
import { useMutation } from '@tanstack/react-query';
import {
  buildRepoDisplayIndex,
  resolveActivityRepoDisplay,
} from '../PushRequests/activityTabFilters';
import { canonicalRemoteUrl } from '../../utils/parseGitRemoteUrl';

const PUSH_DETAILS_TAB_VALUES = ['commits', 'files', 'steps'] as const;
type PushDetailsTab = (typeof PUSH_DETAILS_TAB_VALUES)[number];

function parsePushDetailsTab(raw: string | null): PushDetailsTab {
  return (PUSH_DETAILS_TAB_VALUES as readonly string[]).includes(raw ?? '')
    ? (raw as PushDetailsTab)
    : 'commits';
}

type PushStatusTitle = 'Pending' | 'Approved' | 'Canceled' | 'Rejected';

/** Same primary link treatment as {@link RepositoryMainCell}. */
const repoHeaderLinkClass =
  '!text-[var(--fgColor-accent)] no-underline font-semibold hover:underline';

const commitShaLinkClass = `${repoHeaderLinkClass} break-all font-mono text-sm`;

/** Files in a unified diff (`diff --git` headers). */
function countDiffFiles(diffText: string): number {
  return diffText.match(/^diff --git /gm)?.length ?? 0;
}

function RemoteCommitSha({
  repoWebUrl,
  sha,
  canLink,
}: {
  repoWebUrl: string;
  sha: string | undefined;
  canLink: boolean;
}): React.ReactElement {
  if (!sha) {
    return (
      <Text as='span' className='font-mono text-sm text-(--fgColor-muted)'>
        —
      </Text>
    );
  }
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
    <code className='break-all rounded-sm bg-(--bgColor-muted) px-1.5 py-0.5 font-mono text-sm text-(--fgColor-default)'>
      {sha}
    </code>
  );
}

function CanceledPushBanner({ push }: { push: PushActionView }): React.ReactElement {
  const ts = DateTime.fromMillis(Number(push.timestamp));
  const tsTitle = ts.toFormat('cccc, MMMM d yyyy, h:mm:ss a');
  return (
    <div className='w-full min-w-0'>
      <Banner variant='warning' layout='compact' flush>
        <Banner.Title as='h2' className='!text-base'>
          Push request canceled
        </Banner.Title>
        <Banner.Description>
          <Text as='span' className='text-sm text-(--fgColor-muted)' title={tsTitle}>
            {ts.toLocaleString(DateTime.DATETIME_MED)}
            <span className='text-(--fgColor-muted)'> · </span>
            {ts.toRelative()}
          </Text>
        </Banner.Description>
      </Banner>
    </div>
  );
}

const PushDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const { data: repoListRaw } = useRepoViewsListQuery(true);
  const registeredRepos = useMemo(
    () => (repoListRaw ? sortRepoViews(repoListRaw, 'name-asc') : []),
    [repoListRaw],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(() => parsePushDetailsTab(searchParams.get('tab')), [searchParams]);

  const { data: push, isLoading, isError, error } = usePushQuery(id);
  const { data: permissions = { canCancel: true, canApproveReject: true } } =
    usePushPermissionsQuery(id);

  const setNavTab = useCallback(
    (tab: PushDetailsTab) => {
      const next = new URLSearchParams(searchParams);
      if (tab === 'commits') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!message) return undefined;
    const t = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(t);
  }, [message]);

  const handleActionFailure = (result: ServiceResult) => {
    if (result.status === 401) {
      navigate('/login', { replace: true });
      return;
    }
    setMessage(result.message || 'Something went wrong...');
  };

  const authoriseMutation = useMutation({
    mutationFn: (attestationData: Array<{ label: string; checked: boolean }>) =>
      authorisePush(id!, attestationData),
    onSuccess: (result) => {
      if (result.success) {
        navigate('/dashboard/push/');
      } else {
        handleActionFailure(result);
      }
    },
    onError: () => setMessage('Something went wrong...'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectPush(id!, reason),
    onSuccess: (result) => {
      if (result.success) {
        navigate('/dashboard/push/');
      } else {
        handleActionFailure(result);
      }
    },
    onError: () => setMessage('Something went wrong...'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPush(id!),
    onSuccess: (result) => {
      if (result.success) {
        navigate('/dashboard/push/');
      } else {
        handleActionFailure(result);
      }
    },
    onError: () => setMessage('Something went wrong...'),
  });

  const repoDisplayIndex = useMemo(() => buildRepoDisplayIndex(registeredRepos), [registeredRepos]);
  const repoListLabel = useMemo(
    () => (push ? resolveActivityRepoDisplay(push, repoDisplayIndex) : ''),
    [push, repoDisplayIndex],
  );

  const matchedRepo = useMemo(() => {
    if (!push?.url?.trim()) return undefined;
    const key = canonicalRemoteUrl(push.url);
    if (!key) return undefined;
    return registeredRepos.find((r) => r.url?.trim() && canonicalRemoteUrl(r.url) === key);
  }, [push, registeredRepos]);

  if (isLoading) {
    return (
      <div className='flex w-full min-w-0 items-center gap-2'>
        <Spinner />
        <Text>Loading push…</Text>
      </div>
    );
  }
  if (isError) throw new Error(error?.message || 'Something went wrong ...');
  if (!push) return <div>No push data found</div>;

  const commitCount = push.commitData?.length ?? 0;
  const changeFileCount = countDiffFiles(push.diff?.content ?? '');
  const stepCount = push.steps?.length ?? 0;

  let statusTitle: PushStatusTitle = 'Pending';
  if (push.canceled) {
    statusTitle = 'Canceled';
  }
  if (push.rejected) {
    statusTitle = 'Rejected';
  }
  if (push.authorised) {
    statusTitle = 'Approved';
  }

  const stateLabelStatus: Record<PushStatusTitle, StateLabelProps['status']> = {
    /** Open / awaiting review — matches "open PR" styling */
    Pending: 'pullOpened',
    Approved: 'pullMerged',
    Canceled: 'issueClosedNotPlanned',
    Rejected: 'pullClosed',
  };

  const repoBranch = trimPrefixRefsHeads(push.branch ?? '');
  const repoUrl = push.url;
  const repoWebUrl = trimTrailingDotGit(repoUrl);
  const pendingActions = !(push.canceled || push.rejected || push.authorised);
  const { canCancel, canApproveReject } = permissions;

  /** `commitTo` may not exist on the remote until the push has been approved and completed through the proxy. */
  const commitToOnRemote = push.authorised === true && push.allowPush === true;

  return (
    <div className='w-full min-w-0'>
      <Stack direction='vertical' gap='normal' padding='none'>
        {message.trim() && (
          <Banner
            variant='critical'
            layout='compact'
            className='w-full min-w-0'
            onDismiss={() => setMessage('')}
          >
            <Banner.Title as='h2' className='!text-base'>
              Couldn&apos;t complete action
            </Banner.Title>
            <Banner.Description>
              <Text className='text-sm whitespace-pre-wrap'>{message}</Text>
            </Banner.Description>
          </Banner>
        )}
        <PageHeader as='header' hasBorder>
          <PageHeader.TitleArea variant='large'>
            <Stack
              direction='horizontal'
              gap='normal'
              padding='none'
              align='center'
              wrap='wrap'
              className='min-w-0'
            >
              <StateLabel
                status={stateLabelStatus[statusTitle]}
                size='small'
                data-testid='push-status'
              >
                {statusTitle}
              </StateLabel>
              <PageHeader.Title
                as='h1'
                className='m-0! min-w-0! !text-xl !font-semibold !tracking-tight'
              >
                <span className='inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
                  {matchedRepo?._id ? (
                    <Link to={`/dashboard/repo/${matchedRepo._id}`} className={repoHeaderLinkClass}>
                      {repoListLabel}
                    </Link>
                  ) : (
                    <a
                      href={repoWebUrl}
                      target='_blank'
                      rel='noreferrer'
                      className={repoHeaderLinkClass}
                    >
                      {repoListLabel}
                    </a>
                  )}
                  <GitBranchIcon
                    size={18}
                    className='shrink-0 text-(--fgColor-muted)'
                    aria-hidden
                  />
                  <span className='min-w-0 font-semibold text-(--fgColor-default)'>
                    {repoBranch}
                  </span>
                </span>
              </PageHeader.Title>
            </Stack>
          </PageHeader.TitleArea>
          <PageHeader.Description>
            {DateTime.fromMillis(Number(push.timestamp)).toLocaleString(DateTime.DATETIME_MED)}
            <span className='text-(--fgColor-muted)'> · </span>
            Push request
          </PageHeader.Description>
          {pendingActions ? (
            <PageHeader.Actions>
              <Stack direction='horizontal' gap='condensed' padding='none' wrap='wrap'>
                <Button
                  onClick={() => cancelMutation.mutate()}
                  disabled={!canCancel}
                  data-testid='push-cancel-btn'
                >
                  Cancel
                </Button>
                <Reject
                  rejectFn={(reason) => rejectMutation.mutate(reason)}
                  disabled={!canApproveReject}
                />
                <Attestation
                  approveFn={(attestationData) => authoriseMutation.mutate(attestationData)}
                  disabled={!canApproveReject}
                />
              </Stack>
            </PageHeader.Actions>
          ) : (
            <PageHeader.Navigation aria-label='Push outcome'>
              <Stack direction='vertical' gap='normal' padding='none' className='min-w-0 w-full'>
                {push.rejected && push.rejection ? (
                  <RejectionInfo push={push} />
                ) : push.canceled ? (
                  <CanceledPushBanner push={push} />
                ) : push.authorised && push.attestation ? (
                  <AttestationInfo push={push} />
                ) : null}
              </Stack>
            </PageHeader.Navigation>
          )}
        </PageHeader>

        <GitProxyUnderlinePanels
          key={id}
          aria-label='Push request sections'
          className='min-w-0 w-full'
        >
          <GitProxyUnderlinePanels.Tab
            icon={GitCommitIcon}
            counter={commitCount}
            aria-selected={activeTab === 'commits'}
            onSelect={() => setNavTab('commits')}
          >
            Commits
          </GitProxyUnderlinePanels.Tab>
          <GitProxyUnderlinePanels.Tab
            icon={FileDiffIcon}
            counter={changeFileCount}
            aria-selected={activeTab === 'files'}
            onSelect={() => setNavTab('files')}
          >
            Files changed
          </GitProxyUnderlinePanels.Tab>
          <GitProxyUnderlinePanels.Tab
            icon={WorkflowIcon}
            counter={stepCount}
            aria-selected={activeTab === 'steps'}
            onSelect={() => setNavTab('steps')}
          >
            Steps
          </GitProxyUnderlinePanels.Tab>

          <GitProxyUnderlinePanels.Panel>
            <Stack direction='vertical' gap='normal' padding='none' className='min-w-0'>
              <div className='mt-3 min-w-0 rounded-md border border-(--borderColor-default) px-3 py-3'>
                <Stack
                  direction='horizontal'
                  gap='normal'
                  padding='none'
                  align='center'
                  wrap='wrap'
                  className='min-w-0'
                >
                  <Stack
                    direction='vertical'
                    gap='condensed'
                    padding='none'
                    className='min-w-0 shrink'
                  >
                    <Text className='text-sm font-semibold text-(--fgColor-default)'>
                      Remote head
                    </Text>
                    <RemoteCommitSha
                      repoWebUrl={repoWebUrl}
                      sha={push.commitFrom}
                      canLink={!!push.commitFrom}
                    />
                  </Stack>
                  <ArrowRightIcon
                    className='shrink-0 text-(--fgColor-muted)'
                    size={16}
                    aria-hidden
                  />
                  <Stack
                    direction='vertical'
                    gap='condensed'
                    padding='none'
                    className='min-w-0 shrink'
                  >
                    <Text className='text-sm font-semibold text-(--fgColor-default)'>
                      Commit SHA
                    </Text>
                    <RemoteCommitSha
                      repoWebUrl={repoWebUrl}
                      sha={push.commitTo}
                      canLink={commitToOnRemote}
                    />
                  </Stack>
                </Stack>
              </div>
              <CommitDataTable
                commitData={push.commitData || []}
                repoWebUrl={repoWebUrl}
                tipCommitSha={push.commitTo}
                tipOnRemote={commitToOnRemote}
              />
            </Stack>
          </GitProxyUnderlinePanels.Panel>
          <GitProxyUnderlinePanels.Panel>
            <Diff diff={push.diff?.content || ''} />
          </GitProxyUnderlinePanels.Panel>
          <GitProxyUnderlinePanels.Panel>
            <StepsTimeline steps={push.steps ?? []} />
          </GitProxyUnderlinePanels.Panel>
        </GitProxyUnderlinePanels>
      </Stack>
    </div>
  );
};

export default PushDetails;
