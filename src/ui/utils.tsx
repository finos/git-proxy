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

/**
 * Retrieve a decoded cookie value from `document.cookie` with given `name`.
 * @param {string} name - The name of the cookie to retrieve
 * @return {string | null} - The cookie value or null if not found
 */
export const getCookie = (name: string): string | null => {
  if (!document.cookie) return null;

  const cookies = document.cookie
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(name + '='));

  if (!cookies.length) return null;

  return decodeURIComponent(cookies[0].split('=')[1]);
};
