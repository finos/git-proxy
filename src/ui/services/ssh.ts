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

export interface SSHKey {
  fingerprint: string;
  name: string;
  addedAt: string;
}

export interface SSHConfig {
  enabled: boolean;
  port: number;
  host?: string;
}

export const getSSHConfig = async (): Promise<SSHConfig> => {
  const baseUrl = await getBaseUrl();
  const response: AxiosResponse<SSHConfig> = await axios(
    `${baseUrl}/api/v1/config/ssh`,
    getAxiosConfig(),
  );
  return response.data;
};

export const getSSHKeys = async (username: string): Promise<SSHKey[]> => {
  const baseUrl = await getBaseUrl();
  const response: AxiosResponse<SSHKey[]> = await axios(
    `${baseUrl}/api/v1/user/${username}/ssh-key-fingerprints`,
    getAxiosConfig(),
  );
  return response.data;
};

export const addSSHKey = async (
  username: string,
  publicKey: string,
  name: string,
): Promise<{ message: string; fingerprint: string }> => {
  const baseUrl = await getBaseUrl();
  const response: AxiosResponse<{ message: string; fingerprint: string }> = await axios.post(
    `${baseUrl}/api/v1/user/${username}/ssh-keys`,
    { publicKey, name },
    getAxiosConfig(),
  );
  return response.data;
};

export const deleteSSHKey = async (username: string, fingerprint: string): Promise<void> => {
  const baseUrl = await getBaseUrl();
  await axios.delete(
    `${baseUrl}/api/v1/user/${username}/ssh-keys/${encodeURIComponent(fingerprint)}`,
    getAxiosConfig(),
  );
};
