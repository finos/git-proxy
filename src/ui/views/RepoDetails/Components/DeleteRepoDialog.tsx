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

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, FormControl, IconButton, Stack, TextInput } from '@primer/react';
import type { DialogHeaderProps } from '@primer/react';
import { XIcon } from '@primer/octicons-react';

interface ConfirmDeleteRepoProps {
  repoName: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteRepoDialogHeader = ({
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

const DeleteRepoDialog = ({ repoName, open, onClose, onConfirm }: ConfirmDeleteRepoProps) => {
  const [confirmInput, setConfirmInput] = useState<string>('');

  useEffect(() => {
    if (open) {
      setConfirmInput('');
    }
  }, [open]);

  const handleDialogClose = useCallback(
    (_gesture: 'close-button' | 'escape') => {
      setConfirmInput('');
      onClose();
    },
    [onClose],
  );

  const handleConfirm = () => {
    if (confirmInput !== repoName) return;
    setConfirmInput('');
    onConfirm();
    onClose();
  };

  const canDelete = confirmInput === repoName;

  return open ? (
    <Dialog
      title='Delete Repository'
      subtitle={
        <>
          This action cannot be undone. This will permanently delete the <strong>{repoName}</strong>{' '}
          repository.
        </>
      }
      onClose={handleDialogClose}
      renderHeader={DeleteRepoDialogHeader}
      width='large'
      height='auto'
    >
      <Dialog.Body>
        <Stack direction='vertical' gap='normal' padding='none'>
          <FormControl>
            <FormControl.Label htmlFor='delete-repo-confirm-input'>
              Please type <strong>{repoName}</strong> to confirm:
            </FormControl.Label>
            <TextInput
              id='delete-repo-confirm-input'
              name='confirmRepoName'
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={repoName}
              autoComplete='off'
              block
              autoFocus
            />
          </FormControl>
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <div className='flex w-full justify-end gap-2'>
          <Button type='button' onClick={() => handleDialogClose('close-button')}>
            Cancel
          </Button>
          <Button type='button' variant='danger' disabled={!canDelete} onClick={handleConfirm}>
            Delete Repository
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog>
  ) : null;
};

export default DeleteRepoDialog;
