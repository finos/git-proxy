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

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Navigate, useParams, useLocation } from 'react-router';
import { GearIcon, KeyIcon, ListUnorderedIcon, PlusIcon, TrashIcon } from '@primer/octicons-react';
import {
  Button,
  Dialog,
  FormControl,
  IconButton,
  Label,
  Link as PrimerLink,
  Spinner,
  Stack,
  Text,
  TextInput,
} from '@primer/react';
import type { DialogHeaderProps } from '@primer/react';
import { XIcon } from '@primer/octicons-react';
import { GitProxyUnderlineNav } from '../../components/GitProxyUnderlineTabs';

import { useAuth } from '../../auth/AuthProvider';
import TimedBanner from '../../components/TimedBanner/TimedBanner';
import Danger from '../../components/Typography/Danger';
import { sortRepoViews } from '../../services/repo';
import { useRepoViewsListQuery } from '../../query/useRepoViewsListQuery';
import PushesTable from '../PushRequests/components/PushesTable';
import { useUserQuery } from '../../query/useUserQuery';
import { useUserActivityQuery } from '../../query/useUserActivityQuery';
import {
  getSSHConfig,
  getSSHKeys,
  addSSHKey,
  deleteSSHKey,
  SSHKey,
  SSHConfig,
} from '../../services/ssh';

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

const AddSSHKeyDialogHeader = ({
  dialogLabelId,
  title,
  subtitle,
  dialogDescriptionId,
  onClose,
}: DialogHeaderProps) => (
  <Dialog.Header>
    <div className='flex'>
      <div className='flex min-w-0 flex-1 flex-col px-2 py-1.5'>
        <Dialog.Title id={dialogLabelId}>{title ?? 'Dialog'}</Dialog.Title>
        {subtitle ? <Dialog.Subtitle id={dialogDescriptionId}>{subtitle}</Dialog.Subtitle> : null}
      </div>
      <IconButton
        icon={XIcon}
        aria-label='Close'
        variant='invisible'
        onClick={() => onClose('close-button')}
        unsafeDisableTooltip
      />
    </div>
  </Dialog.Header>
);

const ACTIVITY_ITEMS_PER_PAGE = 100;

type ProfileMainTab = 'activity' | 'settings' | 'ssh-keys';

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

  // SSH state
  const [sshConfig, setSshConfig] = useState<SSHConfig | null>(null);
  const [sshKeys, setSshKeys] = useState<SSHKey[]>([]);
  const [sshKeysLoading, setSshKeysLoading] = useState(false);
  const [sshKeysError, setSshKeysError] = useState('');
  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [addKeyError, setAddKeyError] = useState('');
  const [addKeyLoading, setAddKeyLoading] = useState(false);

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

  // Load SSH config once
  useEffect(() => {
    getSSHConfig()
      .then(setSshConfig)
      .catch(() => {});
  }, []);

  const loadSSHKeys = useCallback(async () => {
    if (!user?.username) return;
    setSshKeysLoading(true);
    setSshKeysError('');
    try {
      const keys = await getSSHKeys(user.username);
      setSshKeys(keys);
    } catch {
      setSshKeysError('Failed to load SSH keys.');
    } finally {
      setSshKeysLoading(false);
    }
  }, [user?.username]);

  const showSSHTab = isOwnProfile && Boolean(sshConfig?.enabled);

  useEffect(() => {
    if (showSSHTab && user?.username) {
      loadSSHKeys();
    }
  }, [showSSHTab, user?.username, loadSSHKeys]);

  const handleAddKey = async () => {
    if (!user?.username) return;
    const key = newKeyValue.trim();
    const name = newKeyName.trim() || 'Unnamed Key';
    if (!key) {
      setAddKeyError('Please enter a public key.');
      return;
    }
    setAddKeyLoading(true);
    setAddKeyError('');
    try {
      await addSSHKey(user.username, key, name);
      setShowAddKeyDialog(false);
      setNewKeyName('');
      setNewKeyValue('');
      await loadSSHKeys();
    } catch (err: any) {
      setAddKeyError(err?.response?.data?.error ?? 'Failed to add SSH key.');
    } finally {
      setAddKeyLoading(false);
    }
  };

  const handleDeleteKey = async (fingerprint: string) => {
    if (!user?.username) return;
    try {
      await deleteSSHKey(user.username, fingerprint);
      await loadSSHKeys();
    } catch {
      setSshKeysError('Failed to delete SSH key.');
    }
  };

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

  const sshKeysSection = (
    <Stack direction='vertical' gap='normal' padding='none' className='min-w-0 w-full'>
      {sshKeysError ? <Danger>{sshKeysError}</Danger> : null}
      {sshKeysLoading ? (
        <Spinner />
      ) : sshKeys.length === 0 ? (
        <Text as='p' size='medium' className='m-0 text-[var(--fgColor-muted)]'>
          No SSH keys configured. Add one to use SSH for git operations.
        </Text>
      ) : (
        <Stack direction='vertical' gap='condensed' padding='none' className='w-full'>
          {sshKeys.map((key) => (
            <div
              key={key.fingerprint}
              className='flex items-center justify-between rounded-md border border-[var(--borderColor-default)] px-3 py-2'
            >
              <Stack direction='vertical' gap='none' padding='none' className='min-w-0'>
                <Text className='text-sm font-semibold text-(--fgColor-default)'>{key.name}</Text>
                <Text className='font-mono text-xs text-(--fgColor-muted)'>{key.fingerprint}</Text>
                <Text className='text-xs text-(--fgColor-muted)'>
                  Added {new Date(key.addedAt).toLocaleDateString()}
                </Text>
              </Stack>
              <IconButton
                icon={TrashIcon}
                aria-label='Delete SSH key'
                variant='invisible'
                size='small'
                className='!text-[var(--fgColor-danger)] shrink-0'
                onClick={() => handleDeleteKey(key.fingerprint)}
                unsafeDisableTooltip
              />
            </div>
          ))}
        </Stack>
      )}
      <div>
        <Button leadingVisual={PlusIcon} onClick={() => setShowAddKeyDialog(true)}>
          Add SSH key
        </Button>
      </div>

      {showAddKeyDialog && (
        <Dialog
          title='Add SSH key'
          renderHeader={AddSSHKeyDialogHeader}
          onClose={() => {
            setShowAddKeyDialog(false);
            setNewKeyName('');
            setNewKeyValue('');
            setAddKeyError('');
          }}
          footerButtons={[
            {
              content: 'Cancel',
              onClick: () => {
                setShowAddKeyDialog(false);
                setNewKeyName('');
                setNewKeyValue('');
                setAddKeyError('');
              },
            },
            {
              content: 'Add key',
              variant: 'primary',
              onClick: handleAddKey,
              disabled: addKeyLoading,
            },
          ]}
        >
          <Stack direction='vertical' gap='normal' padding='none'>
            {addKeyError ? <Danger>{addKeyError}</Danger> : null}
            <FormControl>
              <FormControl.Label>Key name</FormControl.Label>
              <TextInput
                placeholder='e.g. My Laptop'
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                block
              />
            </FormControl>
            <FormControl>
              <FormControl.Label>Public key</FormControl.Label>
              <textarea
                className='w-full rounded-md border border-[var(--borderColor-default)] bg-[var(--bgColor-default)] px-3 py-2 font-mono text-xs text-(--fgColor-default) focus:outline-none focus:ring-2 focus:ring-[var(--focusOutlineColor)]'
                rows={6}
                placeholder='ssh-rsa AAAAB3NzaC1yc2E...'
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
              />
              <FormControl.Caption>
                Paste your public key (e.g. from ~/.ssh/id_rsa.pub)
              </FormControl.Caption>
            </FormControl>
          </Stack>
        </Dialog>
      )}
    </Stack>
  );

  const activeSection = () => {
    if (mainTab === 'ssh-keys') return sshKeysSection;
    if (mainTab === 'settings' && showSettingsTab) return settingsSection;
    return activitySection;
  };

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
            {showSettingsTab || showSSHTab ? (
              <GitProxyUnderlineNav aria-label='Profile sections' className='min-w-0 w-full'>
                <GitProxyUnderlineNav.Item
                  href='#'
                  leadingVisual={<ListUnorderedIcon />}
                  counter={activityLoading ? undefined : activityRows.length}
                  aria-current={mainTab === 'activity' ? 'page' : undefined}
                  onSelect={(e) => {
                    e.preventDefault();
                    setMainTab('activity');
                  }}
                >
                  Activity
                </GitProxyUnderlineNav.Item>
                {showSettingsTab ? (
                  <GitProxyUnderlineNav.Item
                    href='#'
                    leadingVisual={<GearIcon />}
                    aria-current={mainTab === 'settings' ? 'page' : undefined}
                    onSelect={(e) => {
                      e.preventDefault();
                      setMainTab('settings');
                    }}
                  >
                    Settings
                  </GitProxyUnderlineNav.Item>
                ) : null}
                {showSSHTab ? (
                  <GitProxyUnderlineNav.Item
                    href='#'
                    leadingVisual={<KeyIcon />}
                    counter={sshKeysLoading ? undefined : sshKeys.length}
                    aria-current={mainTab === 'ssh-keys' ? 'page' : undefined}
                    onSelect={(e) => {
                      e.preventDefault();
                      setMainTab('ssh-keys');
                    }}
                  >
                    SSH Keys
                  </GitProxyUnderlineNav.Item>
                ) : null}
              </GitProxyUnderlineNav>
            ) : null}
            {activeSection()}
          </Stack>
        ) : null}
      </Stack>
    </div>
  );
}
