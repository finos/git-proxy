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

import React, { useEffect, useState } from 'react';
import { Banner, Button, FormControl, Stack, Text, TextInput } from '@primer/react';
import { CheckIcon, EyeClosedIcon, EyeIcon, TrashIcon } from '@primer/octicons-react';

const JWT_FIELD_ID = 'jwt-token';

const SettingsView = () => {
  const [jwtToken, setJwtToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  useEffect(() => {
    const savedToken = localStorage.getItem('ui_jwt_token');
    if (savedToken) setJwtToken(savedToken);
  }, []);

  useEffect(() => {
    if (!feedbackMessage) return undefined;
    const t = window.setTimeout(() => setFeedbackMessage(''), 3000);
    return () => window.clearTimeout(t);
  }, [feedbackMessage]);

  const handleSave = (): void => {
    localStorage.setItem('ui_jwt_token', jwtToken);
    setFeedbackMessage('JWT token saved');
  };

  const handleClear = (): void => {
    setJwtToken('');
    localStorage.removeItem('ui_jwt_token');
    setFeedbackMessage('JWT token cleared');
  };

  return (
    <form noValidate autoComplete='off' className='w-full min-w-0'>
      <Stack direction='vertical' gap='spacious' padding='none'>
        <Stack direction='vertical' gap='condensed' padding='none' className='min-w-0'>
          <Text as='h1' className='m-0! text-xl! font-semibold! tracking-tight!'>
            JWT Token for UI Authentication
          </Text>
          <Text as='p' className='m-0! mt-1 block text-sm text-(--fgColor-muted)'>
            Authenticates UI requests to the server when &quot;apiAuthentication&quot; is enabled in
            the config.
          </Text>
        </Stack>

        {feedbackMessage ? (
          <Banner
            variant='success'
            layout='compact'
            title={feedbackMessage}
            onDismiss={() => setFeedbackMessage('')}
          />
        ) : null}

        <Stack direction='vertical' gap='normal' padding='none' className='min-w-0'>
          <FormControl>
            <FormControl.Label htmlFor={JWT_FIELD_ID} visuallyHidden>
              JWT token
            </FormControl.Label>
            <TextInput
              id={JWT_FIELD_ID}
              name='jwtToken'
              type={showToken ? 'text' : 'password'}
              placeholder='Enter your JWT token...'
              value={jwtToken}
              onChange={(e) => setJwtToken(e.target.value)}
              block
              autoComplete='off'
              autoFocus
              trailingAction={
                <TextInput.Action
                  icon={showToken ? EyeClosedIcon : EyeIcon}
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                  onClick={() => setShowToken((s) => !s)}
                />
              }
            />
          </FormControl>
          <div className='flex w-full justify-end gap-2'>
            <Button type='button' onClick={handleClear} leadingVisual={TrashIcon}>
              Clear
            </Button>
            <Button type='button' variant='primary' onClick={handleSave} leadingVisual={CheckIcon}>
              Save
            </Button>
          </div>
        </Stack>
      </Stack>
    </form>
  );
};

export default SettingsView;
