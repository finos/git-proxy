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
import {
  Banner,
  Button,
  Dialog,
  FormControl,
  IconButton,
  Stack,
  Text,
  Textarea,
} from '@primer/react';
import type { DialogHeaderProps } from '@primer/react';
import { XIcon } from '@primer/octicons-react';

interface RejectProps {
  rejectFn: (reason: string) => void;
  disabled?: boolean;
}

const REJECT_REASON_ID = 'push-reject-reason';

const RejectDialogHeader = ({
  dialogLabelId,
  title,
  subtitle,
  dialogDescriptionId,
  onClose,
}: DialogHeaderProps) => (
  <Dialog.Header>
    <div className='flex'>
      <div className='flex min-w-0 flex-1 flex-col px-2 py-1.5'>
        <Dialog.Title
          id={dialogLabelId}
          className='!text-base !leading-snug !text-[var(--fgColor-default)]'
        >
          {title ?? 'Dialog'}
        </Dialog.Title>
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

const Reject = ({ rejectFn, disabled }: RejectProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  const handleDialogClose = useCallback((_gesture: 'close-button' | 'escape') => {
    setOpen(false);
    setReason('');
  }, []);

  const handleReject = () => {
    if (!reason.trim()) {
      return;
    }
    rejectFn(reason);
    handleDialogClose('close-button');
  };

  return (
    <>
      <Button
        variant='danger'
        onClick={() => setOpen(true)}
        disabled={disabled}
        data-testid='push-reject-btn'
      >
        Reject
      </Button>
      {open ? (
        <Dialog
          title='Reject this contribution'
          onClose={handleDialogClose}
          renderHeader={RejectDialogHeader}
          width='large'
          height='auto'
        >
          <Dialog.Body>
            <Stack direction='vertical' gap='normal' padding='none'>
              <Banner variant='warning' layout='compact'>
                <Banner.Title
                  as='h2'
                  className='!text-base !font-semibold !text-[var(--fgColor-default)]'
                >
                  You are about to reject this contribution
                </Banner.Title>
                <Banner.Description>
                  <Text as='span' className='!text-base !text-[var(--fgColor-default)]'>
                    This will prevent the push from being published through the proxy. Please
                    explain why so the contributor can address it.
                  </Text>
                </Banner.Description>
              </Banner>
              <FormControl required>
                <FormControl.Label
                  htmlFor={REJECT_REASON_ID}
                  className='!text-base !font-normal !text-[var(--fgColor-default)]'
                >
                  Reason for rejection
                </FormControl.Label>
                <Textarea
                  id={REJECT_REASON_ID}
                  name='rejectReason'
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder='Provide details about why this contribution is being rejected…'
                  rows={5}
                  block
                  resize='vertical'
                  aria-required
                  autoFocus
                  className='!text-base !text-[var(--fgColor-default)]'
                />
              </FormControl>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <div className='flex w-full justify-end gap-2'>
              <Button type='button' onClick={() => handleDialogClose('close-button')}>
                Cancel
              </Button>
              <Button
                type='button'
                variant='danger'
                disabled={!reason.trim()}
                onClick={handleReject}
                data-testid='push-reject-confirm-btn'
              >
                Reject
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      ) : null}
    </>
  );
};

export default Reject;
