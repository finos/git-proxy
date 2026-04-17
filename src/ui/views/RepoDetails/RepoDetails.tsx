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

import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Link as PrimerLink, Spinner, Stack, Text } from '@primer/react';
import { GitProxyUnderlineNav } from '../../components/GitProxyUnderlineTabs';
import { Button as PrimerButton } from '@primer/react';
import { TrashIcon } from '@primer/octicons-react';
import { deleteUser, deleteRepo } from '../../services/repo';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { UserContext } from '../../context';
import { useAuth } from '../../auth/AuthProvider';
import { PublicUser } from '../../../db/types';
import CodeActionButton from '../../components/CustomButtons/CodeActionButton';
import { trimTrailingDotGit } from '../../../db/helper';
import { UserContextType } from '../../context';
import DeleteRepoDialog from './Components/DeleteRepoDialog';
import Danger from '../../components/Typography/Danger';
import TimedBanner from '../../components/TimedBanner/TimedBanner';
import RepoAccessUserTable from './Components/RepoAccessUserTable';
import RepoActivityPanel from './Components/RepoActivityPanel';
import {
  REPO_ACCESS_TABS,
  REPO_ACTIVITY_NAV,
  REPO_NAV_TAB_ORDER,
  isAccessTab,
  parseRepoNavTab,
  type RepoNavTab,
} from './repoAccessConfig';
import { useRepoScmMetadataQuery } from '../../query/useRepoScmMetadataQuery';
import { useRepoQuery } from '../../query/useRepoQuery';
import { useUsersListQuery } from '../../query/useUsersListQuery';
import { usePushesQuery } from '../../query/usePushesQuery';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { repoQueryKeys } from '../../query/repoQueryKeys';

const RepoDetails = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const navTab = useMemo(() => parseRepoNavTab(searchParams.get('tab')), [searchParams]);
  const activeAccess = isAccessTab(navTab) ? REPO_ACCESS_TABS[navTab] : null;

  const setNavTab = useCallback(
    (tab: RepoNavTab) => {
      const next = new URLSearchParams(searchParams);
      if (tab === 'activity') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [mutationError, setMutationError] = useState<string>('');
  const { user } = useContext<UserContextType>(UserContext);
  const { user: sessionUser, isLoading: authLoading } = useAuth();
  const { id: repoId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: repo, isLoading, error: repoError } = useRepoQuery(repoId);

  const { data: remoteRepoData } = useRepoScmMetadataQuery(repo?._id);

  const { data: usersRaw = [] } = useUsersListQuery();
  const userByUsername = useMemo<Record<string, PublicUser>>(() => {
    const next: Record<string, PublicUser> = {};
    for (const u of usersRaw) {
      if (u.username) next[u.username] = u;
    }
    return next;
  }, [usersRaw]);

  const {
    data: repoActivityPushes = [],
    isLoading: repoActivityLoading,
    error: repoActivityError,
  } = usePushesQuery({ url: repo?.url }, Boolean(repo?.url));

  const removeUserMutation = useMutation({
    mutationFn: ({ username, action }: { username: string; action: 'authorise' | 'push' }) =>
      deleteUser(username, repoId!, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: repoQueryKeys.detail(repoId!) });
    },
    onError: (err: unknown) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to remove user');
    },
  });

  const deleteRepoMutation = useMutation({
    mutationFn: (id: string) => deleteRepo(id),
    onSuccess: () => {
      navigate('/dashboard/repo', { replace: true });
    },
    onError: (err: unknown) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete repository');
    },
  });

  const removeAccessUser = useCallback(
    (username: string) => {
      if (!activeAccess || !repoId) return;
      removeUserMutation.mutate({ username, action: activeAccess.apiAction });
    },
    [removeUserMutation, activeAccess, repoId],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: repoQueryKeys.detail(repoId!) });
  }, [queryClient, repoId]);

  if (isLoading) {
    return (
      <div className='flex w-full min-w-0 items-center gap-2'>
        <Spinner />
        <Text>Loading repository…</Text>
      </div>
    );
  }

  if (!repo) return <Danger>{repoError?.message || 'No repository data found'}</Danger>;

  const { url: remoteUrl, proxyURL } = repo;
  const parsedUrl = new URL(remoteUrl);
  const cloneURL = `${proxyURL}/${parsedUrl.host}${parsedUrl.port ? `:${parsedUrl.port}` : ''}${parsedUrl.pathname}`;
  const orgHref = remoteRepoData?.profileUrl;
  const repoHref = remoteRepoData?.htmlUrl?.includes('github.com')
    ? remoteRepoData.htmlUrl
    : trimTrailingDotGit(repo.url);

  return (
    <div className='w-full min-w-0'>
      <TimedBanner
        open={Boolean(mutationError)}
        onDismiss={() => setMutationError('')}
        variant='critical'
        title='Operation failed'
        description={mutationError || undefined}
        className='w-full'
      />
      <Stack direction='vertical' gap='normal' padding='none'>
        <Stack
          direction='horizontal'
          gap='normal'
          padding='none'
          align='center'
          justify='space-between'
        >
          <Stack direction='horizontal' gap='spacious' padding='none' align='center'>
            {remoteRepoData?.avatarUrl ? (
              <img
                width={48}
                height={48}
                className='rounded-md'
                src={remoteRepoData.avatarUrl}
                alt=''
              />
            ) : null}
            <div className='min-w-0'>
              <Text as='h1' className='m-0! text-xl! font-semibold! tracking-tight!'>
                {orgHref ? (
                  <PrimerLink href={orgHref} target='_blank' rel='noopener noreferrer'>
                    {repo.project}
                  </PrimerLink>
                ) : (
                  <span>{repo.project}</span>
                )}
                <span className='text-(--fgColor-muted)'> / </span>
                <PrimerLink href={repoHref} target='_blank' rel='noopener noreferrer'>
                  {repo.name}
                </PrimerLink>
              </Text>
              <Text className='mt-1 block text-sm text-(--fgColor-muted)'>
                <PrimerLink href={repo.url} target='_blank' rel='noopener noreferrer'>
                  {trimTrailingDotGit(repo.url)}
                </PrimerLink>
              </Text>
            </div>
          </Stack>
          <Stack direction='horizontal' gap='condensed' padding='none' align='center'>
            {user?.admin ? (
              <PrimerButton
                variant='danger'
                size='small'
                leadingVisual={TrashIcon}
                data-testid='delete-repo-button'
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete
              </PrimerButton>
            ) : null}
            <CodeActionButton cloneURL={cloneURL} />
          </Stack>
        </Stack>

        {remoteRepoData?.description && (
          <Text
            as='p'
            size='medium'
            weight='normal'
            className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
          >
            {remoteRepoData.description}
          </Text>
        )}

        <GitProxyUnderlineNav aria-label='Repository' variant='flush'>
          {REPO_NAV_TAB_ORDER.map((tab) => {
            if (tab === 'activity') {
              const NavIcon = REPO_ACTIVITY_NAV.NavIcon;
              return (
                <GitProxyUnderlineNav.Item
                  key={tab}
                  href='#'
                  leadingVisual={<NavIcon />}
                  aria-current={navTab === 'activity' ? 'page' : undefined}
                  counter={repoActivityLoading ? undefined : repoActivityPushes.length}
                  onSelect={(
                    e: React.MouseEvent<HTMLAnchorElement> | React.KeyboardEvent<HTMLAnchorElement>,
                  ) => {
                    e.preventDefault();
                    setNavTab('activity');
                  }}
                >
                  {REPO_ACTIVITY_NAV.navLabel}
                </GitProxyUnderlineNav.Item>
              );
            }
            const cfg = REPO_ACCESS_TABS[tab];
            const NavIcon = cfg.NavIcon;
            const count = cfg.selectUsers(repo).length;
            return (
              <GitProxyUnderlineNav.Item
                key={tab}
                href='#'
                leadingVisual={<NavIcon />}
                aria-current={navTab === tab ? 'page' : undefined}
                counter={count}
                onSelect={(
                  e: React.MouseEvent<HTMLAnchorElement> | React.KeyboardEvent<HTMLAnchorElement>,
                ) => {
                  e.preventDefault();
                  setNavTab(tab);
                }}
              >
                {cfg.navLabel}
              </GitProxyUnderlineNav.Item>
            );
          })}
        </GitProxyUnderlineNav>

        {isAccessTab(navTab) && activeAccess ? (
          <RepoAccessUserTable
            usernames={activeAccess.selectUsers(repo)}
            isAdmin={Boolean(user?.admin)}
            onRemove={removeAccessUser}
            ariaLabel={activeAccess.ariaLabel}
            memberLabelPlural={activeAccess.memberLabelPlural}
            repoId={repoId || ''}
            accessAction={activeAccess.apiAction}
            refreshFn={refresh}
            userByUsername={userByUsername}
            sessionUser={sessionUser}
            authLoading={authLoading}
          />
        ) : (
          <RepoActivityPanel
            registeredRepos={[repo]}
            pushes={repoActivityPushes}
            isLoading={repoActivityLoading}
            errorMessage={repoActivityError?.message ?? null}
          />
        )}
      </Stack>

      <DeleteRepoDialog
        repoName={repo.name}
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => deleteRepoMutation.mutate(repo._id!)}
      />
    </div>
  );
};

export default RepoDetails;
