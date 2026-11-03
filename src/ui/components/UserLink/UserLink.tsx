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

interface UserLinkProps {
  username?: string | null;
  children?: React.ReactNode;
}

function getUserProfilePath(username: string): string {
  return `/dashboard/user/${username}`;
}

const UserLink = ({ username, children }: UserLinkProps) => {
  const trimmedUsername = username?.trim() ?? '';
  const content = children ?? trimmedUsername ?? null;
  if (!content) {
    return null;
  }

  return <Link to={getUserProfilePath(trimmedUsername)}>{content}</Link>;
};

export default UserLink;
