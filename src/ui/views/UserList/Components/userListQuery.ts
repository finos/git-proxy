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

import type { UserSortField } from './userSortField';
import { DEFAULT_USER_SORT, isUserSortField } from './userSortField';

export type UserListUrlState = {
  sort: UserSortField;
  filter: string;
  page: number;
};

export const parseUserListUrlState = (params: URLSearchParams): UserListUrlState => {
  const sortRaw = params.get('sort');
  const sort: UserSortField =
    sortRaw !== null && sortRaw !== '' && isUserSortField(sortRaw) ? sortRaw : DEFAULT_USER_SORT;

  const filter = (params.get('filter') ?? '').trim();

  const pageRaw = params.get('page');
  let page = 1;
  if (pageRaw !== null && pageRaw !== '') {
    const n = Number.parseInt(pageRaw, 10);
    if (Number.isFinite(n) && n >= 1) page = n;
  }

  return { sort, filter, page };
};

export const applyUserListUrlPatch = (
  prev: URLSearchParams,
  patch: Partial<Pick<UserListUrlState, 'sort' | 'filter' | 'page'>>,
): URLSearchParams => {
  const current = parseUserListUrlState(prev);
  const merged: UserListUrlState = {
    sort: patch.sort ?? current.sort,
    filter: patch.filter !== undefined ? patch.filter.trim() : current.filter,
    page:
      patch.page !== undefined
        ? Number.isFinite(patch.page) && patch.page >= 1
          ? Math.floor(patch.page)
          : 1
        : current.page,
  };

  const next = new URLSearchParams(prev);
  next.delete('q');

  if (merged.sort === DEFAULT_USER_SORT) next.delete('sort');
  else next.set('sort', merged.sort);

  if (!merged.filter) next.delete('filter');
  else next.set('filter', merged.filter);

  if (merged.page <= 1) next.delete('page');
  else next.set('page', String(merged.page));

  return next;
};
