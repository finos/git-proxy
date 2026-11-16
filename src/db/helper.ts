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

export const toClass = function <T, U>(obj: T, proto: U): U {
  const out = JSON.parse(JSON.stringify(obj));
  out.__proto__ = proto;
  return out as U;
};

export const trimTrailingDotGit = (str: string): string => {
  const target = '.git';
  if (str && str.endsWith(target)) {
    // extract string from 0 to the end minus the length of target
    return str.slice(0, -target.length);
  }
  return str;
};

export const trimPrefixRefsHeads = (str: string): string => {
  const target = 'refs/heads/';
  if (str.startsWith(target)) {
    // extract string from the end of the target to the end of str
    return str.slice(target.length);
  }
  return str;
};

const PROVIDER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * Document path for a user's handle on a provider. Provider names come from
 * configuration and API input, so they are checked before being spliced into a
 * query path: no dots, no leading `$`.
 * @param {string} provider provider name
 * @return {string | null} the field path, or null when the name is not usable
 */
export const scmIdentityField = (provider: string): string | null =>
  PROVIDER_NAME.test(provider) ? `scmIdentities.${provider}` : null;

/** One form for an SCM handle everywhere it is stored or looked up. */
export const normaliseScmLogin = (login: string): string => login.trim().toLowerCase();
