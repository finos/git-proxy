import axios from 'axios';
import type { Request } from 'express';

import { getAPIs } from '../../config';
import { AD, ADProfile } from './types';

const thirdpartyApiConfig = getAPIs();

export const isUserInAdGroup = (
  req: Request & { user?: ADProfile },
  profile: ADProfile,
  ad: AD,
  domain: string,
  name: string,
): Promise<boolean> => {
  // determine, via config, if we're using HTTP or AD directly
  if (thirdpartyApiConfig.ls?.userInADGroup) {
    return isUserInAdGroupViaHttp(profile.username || '', domain, name);
  } else {
    return isUserInAdGroupViaAD(req, profile, ad, domain, name);
  }
};

const isUserInAdGroupViaAD = (
  req: Request & { user?: ADProfile },
  profile: ADProfile,
  ad: AD,
  domain: string,
  name: string,
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    ad.isUserMemberOf(profile.username || '', name, function (err, isMember) {
      if (err) {
        const msg = 'ERROR isUserMemberOf: ' + JSON.stringify(err);
        reject(msg);
      } else {
        console.log(profile.username + ' isMemberOf ' + name + ': ' + isMember);
        resolve(isMember);
      }
    });
  });
};

const isUserInAdGroupViaHttp = (id: string, domain: string, name: string): Promise<boolean> => {
  const url = String(thirdpartyApiConfig.ls?.userInADGroup)
    .replace('<domain>', domain)
    .replace('<name>', name)
    .replace('<id>', id);

  const client = axios.create({
    responseType: 'json',
    headers: {
      'content-type': 'application/json',
    },
  });

  console.log(`checking if user is in group ${url}`);
  return client
    .get(url)
    .then((res) => res.data)
    .catch(() => {
      return false;
    });
};
