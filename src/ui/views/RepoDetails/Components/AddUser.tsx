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

import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Autocomplete,
  Button,
  Dialog,
  FormControl,
  IconButton,
  Spinner,
  Stack,
} from '@primer/react';
import type { DialogHeaderProps } from '@primer/react';
import { PersonAddIcon, XIcon } from '@primer/octicons-react';
import { addUser } from '../../../services/repo';
import { fetchUsersForAutocomplete } from '../../../services/user';
import { PublicUser } from '../../../../db/types';
import Warning from '../../../components/Warning/Warning';

type AccessAction = 'authorise' | 'push';

type UserOption = { id: string; text: string };

const ADD_USER_LABEL_ID = 'add-repo-user-autocomplete-label';

const MIN_AUTOCOMPLETE_CHARS = 2;

/** Close Primer's menu when the query is too short (Overlay must stay mounted for hooks). */
const AutocompleteMinQueryGate = ({
  query,
  minLength,
  children,
}: {
  query: string;
  minLength: number;
  children: React.ReactNode;
}): React.ReactElement => {
  const ctx = useContext(Autocomplete.Context);
  const trimmedLen = query.trim().length;
  useLayoutEffect(() => {
    if (!ctx?.showMenu || trimmedLen >= minLength) return;
    ctx.setShowMenu(false);
  }, [ctx, trimmedLen, minLength]);
  return <>{children}</>;
};

const AddUserAutocompleteInput = ({
  userInputRef,
  filterVal,
  setFilterVal,
  disabled,
  canSubmit,
  onSubmit,
}: {
  userInputRef: React.RefObject<HTMLInputElement | null>;
  filterVal: string;
  setFilterVal: (v: string) => void;
  disabled: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}): React.ReactElement => {
  const ctx = useContext(Autocomplete.Context);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      if (!canSubmit || disabled) return;
      if (ctx?.showMenu) return;
      e.preventDefault();
      onSubmit();
    },
    [canSubmit, disabled, onSubmit, ctx?.showMenu],
  );
  return (
    <Autocomplete.Input
      ref={userInputRef}
      block
      disabled={disabled}
      value={filterVal}
      onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setFilterVal(ev.currentTarget.value)}
      onKeyDown={handleKeyDown}
    />
  );
};

const addUserDialogTitle = (type: AccessAction): string =>
  type === 'authorise' ? 'Add reviewer' : 'Add contributor';

const AddUserDialogHeader = ({
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

interface AddUserDialogProps {
  repoId: string;
  type: AccessAction;
  open: boolean;
  onClose: () => void;
  refreshFn: () => void;
  excludedUsernames: string[];
}

const AddUserDialog = ({
  repoId,
  type,
  open,
  onClose,
  refreshFn,
  excludedUsernames,
}: AddUserDialogProps) => {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [filterVal, setFilterVal] = useState('');
  const userInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setUsers([]);
    setFetchError('');
    setSubmitError('');
    setSelectedItemIds([]);
    setFilterVal('');
    setFetchLoading(true);
    void fetchUsersForAutocomplete()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load users');
        }
      })
      .finally(() => {
        if (!cancelled) setFetchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || fetchLoading) return undefined;
    const id = window.requestAnimationFrame(() => {
      userInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, fetchLoading]);

  const handleDialogClose = useCallback(
    (_gesture: 'close-button' | 'escape') => {
      setSubmitError('');
      setFetchError('');
      setSelectedItemIds([]);
      setFilterVal('');
      onClose();
    },
    [onClose],
  );

  const excluded = useMemo(() => new Set(excludedUsernames), [excludedUsernames]);

  const items: UserOption[] = useMemo(
    () =>
      users
        .filter((u) => u.username && !excluded.has(u.username))
        .map((u) => ({
          id: u.username,
          text: u.displayName?.trim() || u.username,
        })),
    [users, excluded],
  );

  const filterFn = useCallback(
    (item: UserOption) => {
      const q = filterVal.trim().toLowerCase();
      if (!q) return true;
      const u = users.find((x) => x.username === item.id);
      const un = (item.id || '').toLowerCase();
      const git = (u?.gitAccount || '').toLowerCase();
      const dn = (u?.displayName || '').toLowerCase();
      return un.includes(q) || git.includes(q) || dn.includes(q);
    },
    [filterVal, users],
  );

  const handleSelectedChange = useCallback((selected: UserOption | UserOption[]) => {
    const list = Array.isArray(selected) ? selected : [selected];
    const resolved = list.filter((i): i is UserOption => Boolean(i?.id));
    // Primer may pass several ids when changing choice; single variant requires at most one.
    const picked = resolved[resolved.length - 1];
    setSelectedItemIds(picked ? [picked.id] : []);
    // Custom onSelectedChange replaces Primer's default that copies item.text into the input.
    setFilterVal(picked?.text ?? '');
  }, []);

  const handleSubmit = useCallback(async () => {
    const username = selectedItemIds[0];
    if (!username) return;
    setSubmitError('');
    setSubmitLoading(true);
    try {
      await addUser(repoId, username, type);
      refreshFn();
      handleDialogClose('close-button');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSubmitLoading(false);
    }
  }, [selectedItemIds, repoId, type, refreshFn, handleDialogClose]);

  const canSubmit = Boolean(selectedItemIds[0]) && !fetchLoading && !submitLoading;

  if (!open) return null;

  const title = addUserDialogTitle(type);

  return (
    <Dialog
      title={title}
      subtitle='Search by user.'
      onClose={handleDialogClose}
      renderHeader={AddUserDialogHeader}
      width='large'
      height='auto'
      initialFocusRef={userInputRef}
    >
      <Dialog.Body>
        <Stack direction='vertical' gap='normal' padding='none'>
          {fetchError ? <Warning message={fetchError} /> : null}
          {submitError ? <Warning message={submitError} /> : null}
          {fetchLoading ? (
            <div className='flex items-center gap-2'>
              <Spinner />
              <span className='text-sm text-(--fgColor-muted)'>Loading users…</span>
            </div>
          ) : (
            <FormControl>
              <FormControl.Label id={ADD_USER_LABEL_ID}>User</FormControl.Label>
              <Autocomplete>
                <AutocompleteMinQueryGate query={filterVal} minLength={MIN_AUTOCOMPLETE_CHARS}>
                  <AddUserAutocompleteInput
                    userInputRef={userInputRef}
                    filterVal={filterVal}
                    setFilterVal={setFilterVal}
                    disabled={items.length === 0}
                    canSubmit={canSubmit}
                    onSubmit={handleSubmit}
                  />
                  <Autocomplete.Overlay>
                    <Autocomplete.Menu
                      items={items}
                      selectedItemIds={selectedItemIds}
                      selectionVariant='single'
                      filterFn={filterFn}
                      onSelectedChange={handleSelectedChange}
                      loading={false}
                      aria-labelledby={ADD_USER_LABEL_ID}
                      emptyStateText={
                        items.length === 0 ? 'No users available to add' : 'No matching users'
                      }
                    />
                  </Autocomplete.Overlay>
                </AutocompleteMinQueryGate>
              </Autocomplete>
              <FormControl.Caption>
                Type at least {MIN_AUTOCOMPLETE_CHARS} characters to search. Users already on this
                list are hidden.
              </FormControl.Caption>
            </FormControl>
          )}
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <div className='flex w-full justify-end gap-2'>
          <Button
            type='button'
            onClick={() => handleDialogClose('close-button')}
            disabled={submitLoading}
          >
            Cancel
          </Button>
          <Button
            type='button'
            variant='primary'
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitLoading ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog>
  );
};

export interface AddUserProps {
  repoId: string;
  type: AccessAction;
  refreshFn: () => void;
  excludedUsernames: string[];
}

const AddUser = ({ repoId, type, refreshFn, excludedUsernames }: AddUserProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant='default'
        size='small'
        leadingVisual={PersonAddIcon}
        onClick={() => setOpen(true)}
      >
        Add user
      </Button>
      <AddUserDialog
        repoId={repoId}
        type={type}
        open={open}
        onClose={() => setOpen(false)}
        refreshFn={refreshFn}
        excludedUsernames={excludedUsernames}
      />
    </>
  );
};

export default AddUser;
