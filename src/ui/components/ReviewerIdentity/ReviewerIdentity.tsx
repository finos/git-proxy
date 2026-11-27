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
import UserIdentity from '../UserIdentity/UserIdentity';

export interface ReviewerRecord {
  username?: string;
  displayName?: string | null;
  email?: string;
  reviewerEmail?: string;
}

interface ReviewerIdentityProps {
  reviewer?: ReviewerRecord;
  className?: string;
  nameClassName?: string;
  emailClassName?: string;
  emptyClassName?: string;
}

export function reviewerDisplayName(reviewer?: ReviewerRecord): string | undefined {
  const displayName = reviewer?.displayName?.trim();
  if (displayName) return displayName;
  const email = reviewerEmail(reviewer);
  if (!email?.includes('@')) return undefined;
  const local = email.split('@')[0] ?? '';
  if (!local) return undefined;
  return local
    .split(/[._-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function reviewerEmail(reviewer?: ReviewerRecord): string | undefined {
  return reviewer?.email?.trim() || reviewer?.reviewerEmail?.trim() || undefined;
}

const ReviewerIdentity = ({ reviewer, ...classNames }: ReviewerIdentityProps) => {
  const username = reviewer?.username?.trim() || undefined;
  const name = reviewerDisplayName(reviewer);
  const email = reviewerEmail(reviewer);
  const title = name && email ? `${name} <${email}>` : email || name || username;

  return (
    <UserIdentity username={username} name={name} email={email} title={title} {...classNames} />
  );
};

export default ReviewerIdentity;
