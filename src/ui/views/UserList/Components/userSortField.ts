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

export type UserSortField = 'name-asc' | 'name-desc' | 'activity';

export const DEFAULT_USER_SORT: UserSortField = 'name-asc';

export const USER_SORT_NAME_LABEL = 'Name' as const;
export const USER_SORT_ACTIVITY_LABEL = 'Activity' as const;

export const isUserSortField = (value: string): value is UserSortField =>
  value === 'name-asc' || value === 'name-desc' || value === 'activity';

export const userSortDirection = (sort: UserSortField): 'asc' | 'desc' =>
  sort === 'name-desc' ? 'desc' : 'asc';

export const userSortSetDirection = (dir: 'asc' | 'desc'): UserSortField =>
  dir === 'asc' ? 'name-asc' : 'name-desc';
