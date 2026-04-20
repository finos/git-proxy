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

import React, { useState, useMemo, useCallback } from 'react';
import { Navigate, useParams, useLocation } from 'react-router';
import { GearIcon, ListUnorderedIcon } from '@primer/octicons-react';
import { Label, Link as PrimerLink, Spinner, Stack, Text } from '@primer/react';
import { GitProxyUnderlineNav } from '../../components/GitProxyUnderlineTabs';

import { useAuth } from '../../auth/AuthProvider';
import TimedBanner from '../../components/TimedBanner/TimedBanner';
import Danger from '../../components/Typography/Danger';
import { sortRepoViews } from '../../services/repo';
import { useRepoViewsListQuery } from '../../query/useRepoViewsListQuery';
import PushesTable from '../PushRequests/components/PushesTable';
import { useUserQuery } from '../../query/useUserQuery';
import { useUserActivityQuery } from '../../query/useUserActivityQuery';

import { PublicUser } from '../../../db/types';

const externalLinkClass =
  'text-sm text-[#0969da] underline underline-offset-2 decoration-[#0969da]/80 hover:text-[#0550ae]';

/** Route param can be missing under nested dashboard routes; pathname is authoritative for `/dashboard/user/:id`. */
const dashboardUserProfileId = (pathname: string): string | undefined => {
  const m = /^\/dashboard\/user\/([^/]+)\/?$/.exec(pathname);
  return m?.[1];
};

const ProfileField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement => (
  <Stack direction='vertical' gap='condensed' padding='none'>
    <Text className='text-sm font-semibold text-(--fgColor-default)'>{label}</Text>
    <div className='text-sm text-(--fgColor-default)'>{children}</div>
  </Stack>
);

const ACTIVITY_ITEMS_PER_PAGE = 100;

type ProfileMainTab = 'activity' | 'settings';

export default function UserProfile(): React.ReactElement {
  const { user: sessionUser } = useAuth();
  const [showEmailSavedBanner, setShowEmailSavedBanner] = useState<boolean>(false);
  const [localUser, setLocalUser] = useState<PublicUser | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string>('');
  const { data: repoListRaw } = useRepoViewsListQuery(true);
  const registeredRepos = useMemo(
    () => (repoListRaw ? sortRepoViews(repoListRaw, 'name-asc') : []),
    [repoListRaw],
  );
  const [mainTab, setMainTab] = useState<ProfileMainTab>('activity');
  const [activityPage, setActivityPage] = useState<number>(1);
  const { id: idParam } = useParams<{ id?: string }>();
  const { pathname } = useLocation();
  const id = dashboardUserProfileId(pathname) ?? (idParam?.trim() || undefined);

  const { data: fetchedUser, isLoading, error: userError } = useUserQuery(id ?? null);

  // Allow optimistic updates to user (e.g. after email save) without a refetch
  const user = localUser ?? fetchedUser ?? null;

  const activityUsername = useMemo(() => {
    const fromRoute = id?.trim();
    if (fromRoute) return fromRoute;
    return user?.username?.trim() ?? '';
  }, [id, user?.username]);

  const {
    data: activityRows = [],
    isLoading: activityLoading,
    error: activityError,
  } = useUserActivityQuery(activityUsername || undefined);

  const maxActivityPage = Math.max(1, Math.ceil(activityRows.length / ACTIVITY_ITEMS_PER_PAGE));
  const effectiveActivityPage = Math.min(activityPage, maxActivityPage);

  const handleActivityPageChange = useCallback((next: number) => {
    setActivityPage(next);
  }, []);

  const isOwnProfile =
    Boolean(sessionUser) &&
    (id == null ||
      id === '' ||
      (sessionUser != null && sessionUser.username.toLowerCase() === (id ?? '').toLowerCase()));
  const isSessionAdmin = Boolean(sessionUser?.admin);
  const showSettingsTab = isOwnProfile || isSessionAdmin;

  if (isLoading) {
    return (
      <div className='flex w-full min-w-0 items-center gap-2'>
        <Spinner />
      </div>
    );
  }

  if (userError) {
    const status = (userError as any)?.response?.status;
    if (status === 401 && window.location.pathname === '/dashboard/profile') {
      return <Navigate to='/login' />;
    }
    return <Danger>{userError.message}</Danger>;
  }

  if (!user) {
    return (
      <Text
        as='p'
        size='medium'
        weight='normal'
        className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
      >
        No user data available
      </Text>
    );
  }

  const profileNameLabel = user.displayName?.trim() || user.username;
  const roleText = user.title?.trim() ?? '';
  const emailText = user.email?.trim() ?? '';

  const activitySection = (
    <Stack direction='vertical' gap='normal' padding='none' className='min-w-0 w-full'>
      {!activityLoading && !activityError && activityRows.length > 0 ? (
        <Text
          as='p'
          size='medium'
          weight='normal'
          className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
        >
          Pushes committed with this user&apos;s registered emails, or that they approved in the
          dashboard.
        </Text>
      ) : null}
      {activityError ? <Danger>{activityError.message}</Danger> : null}
      {!activityError ? (
        <div className='min-w-0 w-full'>
          {!activityLoading && activityRows.length === 0 ? (
            <Text
              as='p'
              size='medium'
              weight='normal'
              className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
            >
              No activity yet.
            </Text>
          ) : (
            <PushesTable
              registeredRepos={registeredRepos}
              rows={activityRows}
              isLoading={activityLoading}
              currentPage={effectiveActivityPage}
              onPageChange={handleActivityPageChange}
              showStatus
            />
          )}
        </div>
      ) : null}
    </Stack>
  );

  const settingsSection = (
    <Stack direction='vertical' gap='spacious' padding='none' className='min-w-0'>
      {formErrorMessage ? <Danger>{formErrorMessage}</Danger> : null}
      {roleText ? (
        <Stack direction='vertical' gap='normal' padding='none' className='min-w-0'>
          <ProfileField label='Role'>{roleText}</ProfileField>
        </Stack>
      ) : null}
    </Stack>
  );

  return (
    <div className='w-full min-w-0'>
      <Stack direction='vertical' gap='spacious' padding='none'>
        <TimedBanner
          open={showEmailSavedBanner}
          onDismiss={() => setShowEmailSavedBanner(false)}
          title='External email saved'
          description={
            isOwnProfile
              ? 'Your external email has been updated.'
              : "This user's external email has been updated."
          }
        />
        <Stack direction='vertical' gap='condensed' padding='none' className='min-w-0'>
          <Stack direction='horizontal' gap='normal' padding='none' align='center' wrap='wrap'>
            <Text as='h1' className='m-0! text-xl! font-semibold! tracking-tight!'>
              {profileNameLabel}
            </Text>
            {user.admin ? (
              <Label variant='accent' size='small'>
                Admin
              </Label>
            ) : null}
          </Stack>
          {emailText ? (
            <Text className='mt-1 block text-sm text-(--fgColor-muted)'>
              <PrimerLink className={externalLinkClass} href={`mailto:${emailText}`}>
                {emailText}
              </PrimerLink>
            </Text>
          ) : null}
        </Stack>

        {user && activityUsername ? (
          <Stack direction='vertical' gap='normal' padding='none' className='min-w-0 w-full'>
            {showSettingsTab ? (
              <GitProxyUnderlineNav aria-label='Profile sections' className='min-w-0 w-full'>
                <GitProxyUnderlineNav.Item
                  href='#'
                  leadingVisual={<ListUnorderedIcon />}
                  counter={activityLoading ? undefined : activityRows.length}
                  aria-current={mainTab === 'activity' ? 'page' : undefined}
                  onSelect={(
                    e: React.MouseEvent<HTMLAnchorElement> | React.KeyboardEvent<HTMLAnchorElement>,
                  ) => {
                    e.preventDefault();
                    setMainTab('activity');
                  }}
                >
                  Activity
                </GitProxyUnderlineNav.Item>
                <GitProxyUnderlineNav.Item
                  href='#'
                  leadingVisual={<GearIcon />}
                  aria-current={mainTab === 'settings' ? 'page' : undefined}
                  onSelect={(
                    e: React.MouseEvent<HTMLAnchorElement> | React.KeyboardEvent<HTMLAnchorElement>,
                  ) => {
                    e.preventDefault();
                    setMainTab('settings');
                  }}
                >
                  Settings
                </GitProxyUnderlineNav.Item>
              </GitProxyUnderlineNav>
            ) : null}
            {showSettingsTab
              ? mainTab === 'activity'
                ? activitySection
                : settingsSection
              : activitySection}
          </Stack>
        ) : null}
      </Stack>
    </div>
  );
}
