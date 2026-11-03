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

export const repoQueryKeys = {
  all: ['repos'] as const,
  list: (): readonly ['repos', 'list'] => [...repoQueryKeys.all, 'list'],
  detail: (id: string): readonly ['repos', string] => [...repoQueryKeys.all, id],
  scmMetadata: (id: string): readonly ['repos', string, 'scm-metadata'] => [
    ...repoQueryKeys.all,
    id,
    'scm-metadata',
  ],
};
