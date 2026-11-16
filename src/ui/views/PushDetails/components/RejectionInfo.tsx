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
import { DateTime } from 'luxon';
import { Banner, Stack, Text } from '@primer/react';
import UserDisplayLink from '../../../components/UserDisplayLink/UserDisplayLink';
import { PushActionView } from '../../../types';

interface RejectionInfoProps {
  push: PushActionView;
}

const RejectionInfo = ({ push }: RejectionInfoProps) => {
  if (!push.rejection || !push.rejected) {
    return null;
  }

  const rej = push.rejection;
  const ts = DateTime.fromMillis(Number(rej.timestamp));
  const tsTitle = ts.toFormat('cccc, MMMM d yyyy, h:mm:ss a');

  return (
    <div className='w-full min-w-0'>
      <Banner variant='critical' layout='compact' flush>
        <Banner.Title as='h2' className='!text-base'>
          {push.autoRejected ? (
            'Auto-rejected by system'
          ) : (
            <span className='min-w-0'>
              <UserDisplayLink
                username={rej.reviewer.username}
                displayName={rej.reviewer.displayName?.trim() || undefined}
              />{' '}
              rejected this contribution
            </span>
          )}
        </Banner.Title>
        <Banner.Description>
          <Stack direction='vertical' gap='normal' padding='none' className='min-w-0'>
            {rej.reason?.trim() ? (
              <div className='min-w-0 rounded-md border border-(--borderColor-danger-emphasis) bg-(--bgColor-default) px-3 py-2'>
                <Text as='p' className='m-0 text-xs font-semibold text-(--fgColor-danger)'>
                  Reason
                </Text>
                <Text
                  as='p'
                  className='mt-1 mb-0 whitespace-pre-wrap text-sm text-(--fgColor-default)'
                >
                  {rej.reason}
                </Text>
              </div>
            ) : null}
            <Text as='span' className='text-sm text-(--fgColor-muted)' title={tsTitle}>
              {ts.toLocaleString(DateTime.DATETIME_MED)}
              <span className='text-(--fgColor-muted)'> · </span>
              {ts.toRelative()}
            </Text>
          </Stack>
        </Banner.Description>
      </Banner>
    </div>
  );
};

export default RejectionInfo;
