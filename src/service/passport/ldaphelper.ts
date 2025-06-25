import axios, { AxiosInstance } from 'axios';
import { getAPIs } from '../../config';

const thirdpartyApiConfig: Record<string, any> = getAPIs();

const client: AxiosInstance = axios.create({
  responseType: 'json',
  headers: {
    'content-type': 'application/json',
  },
});

export const isUserInAdGroup = async (
  id: string,
  domain: string,
  name: string
): Promise<boolean> => {
  const url = String(thirdpartyApiConfig.ls.userInADGroup)
    .replace('<domain>', domain)
    .replace('<name>', name)
    .replace('<id>', id);

  console.log(`checking if user is in group ${url}`);

  try {
    const res = await client.get<boolean>(url);
    return res.data;
  } catch {
    return false;
  }
};
