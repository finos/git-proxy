import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URI
  ? `${import.meta.env.VITE_API_URI}/api/v1/user`
  : `${location.origin}/api/v1/user`;

const AXIOS_CFG = { withCredentials: true };

export async function getSSHKeys(username) {
  const { data } = await axios.get(`${BASE_URL}/${username}/ssh-keys`, AXIOS_CFG);
  return data.publicKeys || [];
}

export async function deleteSSHKey(username, fingerprint) {
  await axios.delete(`${BASE_URL}/${username}/ssh-keys/fingerprint`, {
    ...AXIOS_CFG,
    data: { fingerprint },
  });
}

export async function addSSHKey(username, key) {
  await axios.post(`${BASE_URL}/${username}/ssh-keys`, key, AXIOS_CFG);
}
