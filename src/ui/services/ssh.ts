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
