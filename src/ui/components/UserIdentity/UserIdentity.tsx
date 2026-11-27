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
import { useDisplayNameQuery } from '../../query/useDisplayNameQuery';
import { useUsernameByEmailQuery } from '../../query/useUsernameByEmailQuery';

export interface UserIdentityProps {
  /** GitProxy username — when set, renders name/display as a profile link. */
  username?: string;
  /** Display name or commit author name. */
  name?: string;
  /** Email address shown below the name. */
  email?: string;
  /** Tooltip text on the name element. */
  title?: string;
  className?: string;
  nameClassName?: string;
  emailClassName?: string;
  emptyClassName?: string;
}

/**
 * Displays a user identity (name and/or email) with an optional link to their
 * GitProxy profile when a username is available.
 */
const UserIdentity = ({
  username,
  name,
  email,
  title,
  className,
  nameClassName,
  emailClassName,
  emptyClassName,
}: UserIdentityProps): React.ReactElement => {
  const trimmedUsername = username?.trim() || '';
  const trimmedName = name?.trim() || '';
  const displayEmail = email?.trim() || '';
  const { data: resolvedUsername = null } = useUsernameByEmailQuery(
    !trimmedUsername && displayEmail ? displayEmail.toLowerCase() : undefined,
  );
  const { data: resolvedDisplayName = null } = useDisplayNameQuery(
    trimmedUsername && !trimmedName ? trimmedUsername : undefined,
  );
  const profileUsername = trimmedUsername || resolvedUsername;
  const displayName =
    trimmedName || (trimmedUsername ? resolvedDisplayName || trimmedUsername : '');

  if (!displayName && !displayEmail) {
    return <span className={emptyClassName}>—</span>;
  }

  return (
    <span className={className}>
      {displayName ? (
        profileUsername ? (
          <Link
            to={`/dashboard/user/${encodeURIComponent(profileUsername)}`}
            className={nameClassName}
            title={title}
            onClick={(event: React.MouseEvent) => event.stopPropagation()}
          >
            {displayName}
          </Link>
        ) : (
          <span className={nameClassName} title={title}>
            {displayName}
          </span>
        )
      ) : null}
      {displayEmail ? <span className={emailClassName}>{displayEmail}</span> : null}
    </span>
  );
};

export default UserIdentity;
