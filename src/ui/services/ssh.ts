import axios, { AxiosResponse } from 'axios';
import { getAxiosConfig } from './auth';
import { API_BASE } from '../apiBase';

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
  const response: AxiosResponse<SSHConfig> = await axios(
    `${API_BASE}/api/v1/config/ssh`,
    getAxiosConfig(),
  );
  return response.data;
};

export const getSSHKeys = async (username: string): Promise<SSHKey[]> => {
  const response: AxiosResponse<SSHKey[]> = await axios(
    `${API_BASE}/api/v1/user/${username}/ssh-key-fingerprints`,
    getAxiosConfig(),
  );
  return response.data;
};

export const addSSHKey = async (
  username: string,
  publicKey: string,
  name: string,
): Promise<{ message: string; fingerprint: string }> => {
  const response: AxiosResponse<{ message: string; fingerprint: string }> = await axios.post(
    `${API_BASE}/api/v1/user/${username}/ssh-keys`,
    { publicKey, name },
    getAxiosConfig(),
  );
  return response.data;
};

export const deleteSSHKey = async (username: string, fingerprint: string): Promise<void> => {
  await axios.delete(
    `${API_BASE}/api/v1/user/${username}/ssh-keys/${encodeURIComponent(fingerprint)}`,
    getAxiosConfig(),
  );
};
