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
import { Link } from 'react-router';
import { Text } from '@primer/react';
import { PublicUser } from '../../../db/types';

export function canNavigateToUserProfile(session: PublicUser | null, targetUsername: string) {
  if (!targetUsername || !session) {
    return false;
  }
  return true;
}

/** Matches styling used in the admin users list table */
export const userTableNameLinkClass =
  'font-semibold text-[#0969da] underline underline-offset-2 decoration-[#0969da]/80 hover:text-[#0550ae]';

export interface UserTableNameCellProps {
  username: string;
  /** Profile row from the user directory; when missing, only `username` is shown */
  profile?: PublicUser | null;
  sessionUser: PublicUser | null;
  authLoading: boolean;
}

export default function UserTableNameCell({
  username,
  profile,
  sessionUser,
  authLoading,
}: UserTableNameCellProps): React.ReactElement {
  const canNav = canNavigateToUserProfile(sessionUser, username);
  const showLink = !authLoading && canNav;
  const label = profile?.displayName?.trim() || username;

  if (showLink) {
    return (
      <Text as='div' size='medium' weight='semibold'>
        <Link
          to={`/dashboard/user/${encodeURIComponent(username)}`}
          className={userTableNameLinkClass}
          aria-label={`View profile for ${username}`}
        >
          {label}
        </Link>
      </Text>
    );
  }

  return (
    <Text as='div' size='medium' weight='semibold' className='text-[#1f2328]'>
      {label}
    </Text>
  );
}
