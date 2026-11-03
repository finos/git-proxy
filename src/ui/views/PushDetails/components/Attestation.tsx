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
import { Banner, Button, Dialog, IconButton, Stack, Text } from '@primer/react';
import type { DialogHeaderProps } from '@primer/react';
import { XIcon } from '@primer/octicons-react';
import AttestationForm from './AttestationForm';
import { setAttestationConfigData, setEmailContactData } from '../../../services/config';
import { QuestionFormData } from '../../../types';

interface AttestationProps {
  approveFn: (data: { label: string; checked: boolean }[]) => void;
  disabled?: boolean;
}

const AttestationDialogHeader = ({
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
          className='text-base! leading-snug! text-(--fgColor-default)!'
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

const Attestation = ({ approveFn, disabled }: AttestationProps) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<QuestionFormData[]>([]);
  const [contactEmail, setContactEmail] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setAttestationConfigData(setFormData);
    }

    if (open && !contactEmail) {
      setEmailContactData(setContactEmail);
    }
  }, [open, contactEmail]);

  const handleDialogClose = useCallback((_gesture: 'close-button' | 'escape') => {
    setOpen(false);
  }, []);

  const handleApprove = () => {
    const data = formData.map((question) => ({
      label: question.label,
      checked: question.checked,
    }));
    approveFn(data);
    handleDialogClose('close-button');
  };

  return (
    <>
      <Button
        variant='primary'
        onClick={() => setOpen(true)}
        disabled={disabled}
        data-testid='attestation-open-btn'
      >
        Approve
      </Button>
      {open ? (
        <Dialog
          title='Approve contribution'
          onClose={handleDialogClose}
          renderHeader={AttestationDialogHeader}
          width='large'
          height='auto'
        >
          <Dialog.Body>
            <div data-testid='attestation-dialog' className='min-w-0'>
              <Stack direction='vertical' gap='normal' padding='none'>
                <Banner variant='info' layout='compact'>
                  <Banner.Title
                    as='h2'
                    className='text-base! font-semibold! text-(--fgColor-default)!'
                  >
                    You are about to approve this contribution for publication
                  </Banner.Title>
                  <Banner.Description>
                    <Text as='span' className='text-base! text-(--fgColor-default)!'>
                      If you are unsure, review your organization&apos;s open source contribution
                      policy or{' '}
                      {contactEmail.trim() ? (
                        <a
                          href={`mailto:${contactEmail.trim()}`}
                          className='text-(--fgColor-accent) underline hover:no-underline'
                        >
                          contact the Open Source Program Office
                        </a>
                      ) : (
                        'contact the Open Source Program Office'
                      )}
                      .
                    </Text>
                  </Banner.Description>
                </Banner>
                <Text as='p' className='m-0 text-base! text-(--fgColor-default)!'>
                  By approving, I confirm that:
                </Text>
                <AttestationForm formData={formData} passFormData={setFormData} />
              </Stack>
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <div className='flex w-full justify-end gap-2'>
              <Button
                type='button'
                onClick={() => handleDialogClose('close-button')}
                data-testid='attestation-cancel-btn'
              >
                Cancel
              </Button>
              <Button
                type='button'
                variant='primary'
                onClick={handleApprove}
                disabled={!formData.every((question) => question.checked)}
                data-testid='attestation-confirm-btn'
              >
                Approve
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      ) : null}
    </>
  );
};

export default Attestation;
