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

import axios, { AxiosResponse } from 'axios';
import { getAxiosConfig } from './auth';
import { getBaseUrl } from './apiConfig';

export interface ScmProviderSummary {
  name: string;
  type: 'github' | 'gitlab' | 'forgejo';
  host: string;
}

export const getScmProviders = async (): Promise<ScmProviderSummary[]> => {
  const baseUrl = await getBaseUrl();
  const response: AxiosResponse<ScmProviderSummary[]> = await axios(
    `${baseUrl}/api/v1/config/scmProviders`,
    getAxiosConfig(),
  );
  return response.data;
};

/**
 * Link (or, with a null login, unlink) a user's account on an SCM provider.
 * @param {string} username git-proxy user to update
 * @param {string} provider configured provider name
 * @param {string | null} login account handle on that provider
 */
export const setScmIdentity = async (
  username: string,
  provider: string,
  login: string | null,
): Promise<void> => {
  const baseUrl = await getBaseUrl();
  await axios.post(
    `${baseUrl}/api/auth/scm-identity`,
    { username, provider, login },
    getAxiosConfig(),
  );
};
