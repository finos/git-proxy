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
import UserLink from '../UserLink/UserLink';
import { useDisplayNameQuery } from '../../query/useDisplayNameQuery';

export interface UserDisplayLinkProps {
  username: string;
  /** When set (e.g. from persisted attestation), avoids a profile fetch */
  displayName?: string | null;
}

function trimValue(value?: string | null): string {
  return value?.trim() ?? '';
}

const UserDisplayLink = ({ username, displayName }: UserDisplayLinkProps) => {
  const trimmedUsername = trimValue(username);
  const trimmedDisplayName = trimValue(displayName);

  const { data: resolvedLabel = null } = useDisplayNameQuery(
    trimmedUsername && !trimmedDisplayName ? trimmedUsername : undefined,
  );

  if (!trimmedUsername) {
    return null;
  }

  const label = trimmedDisplayName || resolvedLabel || trimmedUsername;

  return <UserLink username={trimmedUsername}>{label}</UserLink>;
};

export default UserDisplayLink;
