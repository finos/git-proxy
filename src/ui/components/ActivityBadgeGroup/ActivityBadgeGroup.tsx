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
import { Link, Stack } from '@primer/react';
import {
  AlertIcon,
  BlockedIcon,
  CheckCircleIcon,
  EyeIcon,
  XCircleIcon,
} from '@primer/octicons-react';
import type { Icon } from '@primer/octicons-react';
import { RepoActivityTabCounts } from '../../../db/types';

type ActivityStatus = keyof RepoActivityTabCounts;

interface BadgeConfig {
  status: ActivityStatus;
  icon: Icon;
  className: string;
  label: (count: number) => string;
}

const badgeConfigs: BadgeConfig[] = [
  {
    status: 'pending',
    icon: EyeIcon,
    className:
      'inline-flex items-center gap-1 rounded-full border border-[var(--borderColor-attention-muted)] bg-[var(--bgColor-attention-muted)] px-2 py-0.5 text-xs font-medium text-[var(--fgColor-attention)] !no-underline hover:border-[var(--borderColor-attention-emphasis)]',
    label: () => 'pending',
  },
  {
    status: 'approved',
    icon: CheckCircleIcon,
    className:
      'inline-flex items-center gap-1 rounded-full border border-[var(--borderColor-success-muted)] bg-[var(--bgColor-success-muted)] px-2 py-0.5 text-xs font-medium text-[var(--fgColor-success)] !no-underline hover:border-[var(--borderColor-success-emphasis)]',
    label: () => 'approved',
  },
  {
    status: 'canceled',
    icon: XCircleIcon,
    className:
      'inline-flex items-center gap-1 rounded-full border border-[var(--borderColor-default)] bg-[var(--bgColor-muted)] px-2 py-0.5 text-xs font-medium text-[var(--fgColor-muted)] !no-underline hover:border-[var(--borderColor-neutral-emphasis)]',
    label: () => 'canceled',
  },
  {
    status: 'rejected',
    icon: BlockedIcon,
    className:
      'inline-flex items-center gap-1 rounded-full border border-[var(--borderColor-danger-muted)] bg-[var(--bgColor-danger-muted)] px-2 py-0.5 text-xs font-medium text-[var(--fgColor-danger)] !no-underline hover:border-[var(--borderColor-danger-emphasis)]',
    label: () => 'rejected',
  },
  {
    status: 'error',
    icon: AlertIcon,
    className:
      'inline-flex items-center gap-1 rounded-full border border-[var(--borderColor-danger-muted)] bg-[var(--bgColor-danger-muted)] px-2 py-0.5 text-xs font-medium text-[var(--fgColor-danger)] !no-underline hover:border-[var(--borderColor-danger-emphasis)]',
    label: (count) => (count === 1 ? 'error' : 'errors'),
  },
];

interface ActivityBadgeGroupProps {
  activity: RepoActivityTabCounts;
  hrefForStatus: (status: ActivityStatus) => string;
}

const ActivityBadgeGroup = ({
  activity,
  hrefForStatus,
}: ActivityBadgeGroupProps): React.ReactElement => (
  <Stack direction='horizontal' gap='condensed' wrap='wrap' align='center' padding='none'>
    {badgeConfigs.map(({ status, icon: BadgeIcon, className, label }) => {
      const count = activity[status];
      if (count <= 0) return null;
      return (
        <Link
          key={status}
          href={hrefForStatus(status)}
          className={className}
          aria-label={`${count} ${label(count)} — open activity`}
        >
          <BadgeIcon size='small' /> {count} {label(count)}
        </Link>
      );
    })}
  </Stack>
);

export default ActivityBadgeGroup;
