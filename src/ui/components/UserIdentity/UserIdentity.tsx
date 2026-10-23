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
  const displayName = name?.trim() || username?.trim() || '';
  const displayEmail = email?.trim() || '';

  if (!displayName && !displayEmail) {
    return <span className={emptyClassName}>—</span>;
  }

  return (
    <span className={className}>
      {displayName ? (
        username ? (
          <Link
            to={`/dashboard/user/${encodeURIComponent(username)}`}
            className={nameClassName}
            title={title}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
