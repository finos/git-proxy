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
import { Link, Stack, Text } from '@primer/react';
import { LawIcon, RepoIcon } from '@primer/octicons-react';
import ActivityBadgeGroup from '../../../components/ActivityBadgeGroup/ActivityBadgeGroup';
import CodeActionButton from '../../../components/CustomButtons/CodeActionButton';
import { languageColors } from '../../../../constants/languageColors';
import { RepoView } from '../../../types';
import { useRepoScmMetadataQuery } from '../../../query/useRepoScmMetadataQuery';
import { DEFAULT_ACTIVITY_TAB, type ActivityTab } from '../../PushRequests/activityListQuery';

export function cloneURLForRepo(repo: RepoView): string {
  const { url: remoteUrl, proxyURL } = repo;
  const parsedUrl = new URL(remoteUrl);
  return `${proxyURL}/${parsedUrl.host}${parsedUrl.port ? `:${parsedUrl.port}` : ''}${parsedUrl.pathname}`;
}

function isAbsoluteHttpUrl(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://');
}

/** Deep-link to Activity with optional repo filter; omits default `pending` tab query. */
function activityListHref(repoId: string, tab: ActivityTab): string {
  const params = new URLSearchParams();
  params.set('repo', repoId);
  if (tab !== 'all' && tab !== DEFAULT_ACTIVITY_TAB) {
    params.set('tab', tab);
  }
  return `/dashboard/push?${params.toString()}`;
}

/** GitHub org repositories–style primary cell (name, fork line, description, metadata row). */
export function RepositoryMainCell({ repo }: { repo: RepoView }): React.ReactElement {
  const { data: remoteRepoData } = useRepoScmMetadataQuery(repo._id);

  const mutedMeta = 'text-xs font-light text-[var(--fgColor-muted)] whitespace-nowrap';

  const avatarUrl = remoteRepoData?.avatarUrl;

  return (
    <Stack direction='horizontal' gap='normal' padding='none' align='start' className='min-w-0'>
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md${
          avatarUrl ? '' : ' border border-[var(--borderColor-default)] bg-[var(--bgColor-muted)]'
        }`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt='' className='h-full w-full object-cover' />
        ) : (
          <RepoIcon size={16} className='text-[var(--fgColor-muted)]' aria-hidden />
        )}
      </div>
      <Stack direction='vertical' gap='condensed' padding='none' className='min-w-0'>
        <Text as='div' size='medium' weight='semibold'>
          <Link
            href={`/dashboard/repo/${repo._id}`}
            className='!text-[var(--fgColor-accent)] no-underline hover:underline'
          >
            {repo.project}/{repo.name}
          </Link>
        </Text>
        {remoteRepoData?.parentName ? (
          <Text as='div' className='text-xs font-light leading-default text-[var(--fgColor-muted)]'>
            Forked from{' '}
            {remoteRepoData.parentUrl ? (
              <Link
                href={remoteRepoData.parentUrl}
                muted
                className='hover:underline'
                {...(isAbsoluteHttpUrl(remoteRepoData.parentUrl)
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {remoteRepoData.parentName}
              </Link>
            ) : (
              remoteRepoData.parentName
            )}
          </Text>
        ) : null}
        {remoteRepoData?.description ? (
          <Text
            as='p'
            size='medium'
            weight='normal'
            className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
          >
            {remoteRepoData.description}
          </Text>
        ) : null}
        <Stack direction='horizontal' gap='condensed' wrap='wrap' align='center' padding='none'>
          {remoteRepoData?.language ? (
            <Text as='span' className={mutedMeta}>
              <span
                style={{
                  height: 12,
                  width: 12,
                  backgroundColor: languageColors[remoteRepoData.language] || '#ccc',
                  borderRadius: '50%',
                  display: 'inline-block',
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
              {remoteRepoData.language}
            </Text>
          ) : null}
          {remoteRepoData?.license ? (
            <Text as='span' className={`${mutedMeta} inline-flex items-center gap-1`}>
              <LawIcon size='small' /> {remoteRepoData.license}
            </Text>
          ) : null}
        </Stack>
        {repo.activity && repo._id ? (
          <ActivityBadgeGroup
            activity={repo.activity}
            hrefForStatus={(status) => activityListHref(repo._id!, status)}
          />
        ) : null}
      </Stack>
    </Stack>
  );
}

export function RepositoryActionCell({ repo }: { repo: RepoView }): React.ReactElement {
  return <CodeActionButton cloneURL={cloneURLForRepo(repo)} />;
}
