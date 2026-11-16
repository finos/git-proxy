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

import type { ComponentType } from 'react';
import type { IconProps } from '@primer/octicons-react';
import { CodeReviewIcon, PeopleIcon, PulseIcon } from '@primer/octicons-react';
import { RepoView } from '../../types';

export type AccessTab = 'reviewers' | 'contributors';
export type RepoNavTab = AccessTab | 'activity';

export type RepoAccessApiAction = 'authorise' | 'push';

export interface RepoAccessTabConfig {
  apiAction: RepoAccessApiAction;
  memberLabelPlural: string;
  ariaLabel: string;
  navLabel: string;
  NavIcon: ComponentType<IconProps>;
  selectUsers: (repo: RepoView) => string[];
}

export const REPO_ACCESS_TABS: Record<AccessTab, RepoAccessTabConfig> = {
  reviewers: {
    apiAction: 'authorise',
    memberLabelPlural: 'reviewers',
    ariaLabel: 'Repository reviewers',
    navLabel: 'Reviewers',
    NavIcon: CodeReviewIcon,
    selectUsers: (r) => r.users?.canAuthorise ?? [],
  },
  contributors: {
    apiAction: 'push',
    memberLabelPlural: 'contributors',
    ariaLabel: 'Repository contributors',
    navLabel: 'Contributors',
    NavIcon: PeopleIcon,
    selectUsers: (r) => r.users?.canPush ?? [],
  },
};

export const REPO_NAV_TAB_ORDER: RepoNavTab[] = ['activity', 'reviewers', 'contributors'];

export const REPO_ACTIVITY_NAV = {
  navLabel: 'Activity',
  ariaLabel: 'Repository push activity',
  NavIcon: PulseIcon,
} as const;

export function parseRepoNavTab(raw: string | null): RepoNavTab {
  return (REPO_NAV_TAB_ORDER as string[]).includes(raw ?? '') ? (raw as RepoNavTab) : 'activity';
}

export function isAccessTab(tab: RepoNavTab): tab is AccessTab {
  return tab === 'reviewers' || tab === 'contributors';
}
