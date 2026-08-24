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
import { useNavigate } from 'react-router';
import { Button, Stack, Text } from '@primer/react';
import { ShieldLockIcon } from '@primer/octicons-react';

const NotAuthorized = () => {
  const navigate = useNavigate();

  return (
    <div className='flex min-h-[50vh] flex-col items-center justify-center px-4 py-12'>
      <Stack
        direction='vertical'
        gap='normal'
        padding='none'
        align='center'
        className='max-w-md text-center'
      >
        <ShieldLockIcon size={48} className='text-[var(--fgColor-danger)]' aria-hidden />
        <Text as='h1' className='m-0 !text-xl !font-semibold !text-[var(--fgColor-default)]'>
          403 — Not authorized
        </Text>
        <Text as='p' className='m-0 !text-base !text-[var(--fgColor-default)]'>
          You do not have permission to access this page. Contact your administrator for more
          information, or try logging in with a different account.
        </Text>
        <Button type='button' variant='primary' className='mt-2' onClick={() => navigate('/')}>
          Go to home
        </Button>
      </Stack>
    </div>
  );
};

export default NotAuthorized;
