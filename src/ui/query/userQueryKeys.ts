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

export const userQueryKeys = {
  all: ['users'] as const,
  list: () => [...userQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...userQueryKeys.all, id] as const,
  activity: (username: string) => [...userQueryKeys.all, username, 'activity'] as const,
  displayName: (username: string) => [...userQueryKeys.all, username, 'displayName'] as const,
  byEmail: (email: string) => [...userQueryKeys.all, 'byEmail', email] as const,
};
