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
import { Banner, Text } from '@primer/react';
import UserDisplayLink from '../../../components/UserDisplayLink/UserDisplayLink';
import { PushActionView } from '../../../types';

interface AttestationInfoProps {
  push: PushActionView;
}

const AttestationInfo = ({ push }: AttestationInfoProps) => {
  if (!push.attestation || !push.authorised) {
    return null;
  }

  const att = push.attestation;
  const ts = DateTime.fromMillis(Number(att.timestamp));
  const tsTitle = ts.toFormat('cccc, MMMM d yyyy, h:mm:ss a');
  const presetDisplayName = att.reviewer.displayName?.trim() || undefined;

  return (
    <div className='w-full min-w-0'>
      <Banner
        variant='success'
        layout='compact'
        flush
        description={
          <Text as='span' className='text-sm text-(--fgColor-muted)' title={tsTitle}>
            {ts.toLocaleString(DateTime.DATETIME_MED)}
            <span className='text-(--fgColor-muted)'> · </span>
            {ts.toRelative()}
          </Text>
        }
      >
        <Banner.Title as='h2' className='!text-base'>
          {push.autoApproved ? (
            'Auto-approved by system'
          ) : (
            <span className='min-w-0'>
              <UserDisplayLink
                username={att.reviewer.username}
                displayName={presetDisplayName || undefined}
              />{' '}
              approved this contribution
            </span>
          )}
        </Banner.Title>
      </Banner>
    </div>
  );
};

export default AttestationInfo;
