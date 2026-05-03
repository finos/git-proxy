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

import { Client } from 'ldapts';
import { Strategy as CustomStrategy } from 'passport-custom';
import type { PassportStatic } from 'passport';
import type { Request } from 'express';

import * as db from '../../db';
import { getAuthMethods } from '../../config';
import { LdapConfig } from '../../config/generated/config';
import { handleErrorAndLog } from '../../utils/errors';

export const type = 'ldap';

/**
 * Escape special characters in LDAP filter values per RFC 4515.
 */
export const escapeFilterValue = (value: string): string => {
  let result = '';
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code === 0 || '\\*()|&!=<>~'.includes(ch)) {
      result += '\\' + code.toString(16).padStart(2, '0');
    } else {
      result += ch;
    }
  }
  return result;
};

const getLdapConfig = (): LdapConfig => {
  const authMethods = getAuthMethods();
  const config = authMethods.find((method) => method.type.toLowerCase() === type);

  if (!config || !config.ldapConfig) {
    throw new Error('LDAP authentication method not enabled or missing ldapConfig');
  }

  const lc = config.ldapConfig;
  const requiredFields = [
    'url',
    'bindDN',
    'bindPassword',
    'searchBase',
    'searchFilter',
    'userGroupDN',
    'adminGroupDN',
  ] as const;
  for (const field of requiredFields) {
    if (!lc[field]) {
      throw new Error(`LDAP configuration field "${field}" is required but empty`);
    }
  }

  return lc;
};

const createClient = (ldapConfig: LdapConfig): Client => {
  return new Client({
    url: ldapConfig.url,
    tlsOptions: ldapConfig.tlsOptions,
    strictDN: true,
  });
};

/**
 * Search for a user entry in LDAP using the service account.
 */
export const searchUser = async (
  client: Client,
  ldapConfig: LdapConfig,
  username: string,
): Promise<Record<string, unknown> | null> => {
  const filter = ldapConfig.searchFilter.replaceAll('{{username}}', escapeFilterValue(username));

  const { searchEntries } = await client.search(ldapConfig.searchBase, {
    scope: 'sub',
    filter,
  });

  if (searchEntries.length === 0) {
    return null;
  }

  if (searchEntries.length > 1) {
    console.warn(
      `ldap: search filter matched ${searchEntries.length} entries for username "${username}", expected exactly 1`,
    );
    return null;
  }

  return searchEntries[0] as Record<string, unknown>;
};

/**
 * Check if a user is a member of a specific group by searching for a group
 * entry that references the user's DN.
 */
export const isUserInGroup = async (
  client: Client,
  ldapConfig: LdapConfig,
  userDN: string,
  groupDN: string,
): Promise<boolean> => {
  const groupFilter = (ldapConfig.groupSearchFilter || '(member={{dn}})').replaceAll(
    '{{dn}}',
    escapeFilterValue(userDN),
  );

  const searchBase = ldapConfig.groupSearchBase || groupDN;

  try {
    const { searchEntries } = await client.search(searchBase, {
      scope: 'sub',
      filter: `(&(objectClass=*)${groupFilter})`,
    });

    return searchEntries.some(
      (entry) => typeof entry.dn === 'string' && entry.dn.toLowerCase() === groupDN.toLowerCase(),
    );
  } catch {
    return false;
  }
};

/**
 * Verify user credentials via user bind (separate connection).
 */
const verifyPassword = async (
  ldapConfig: LdapConfig,
  userDN: string,
  password: string,
): Promise<boolean> => {
  const userClient = createClient(ldapConfig);
  try {
    if (ldapConfig.starttls) {
      await userClient.startTLS(ldapConfig.tlsOptions || {});
    }
    await userClient.bind(userDN, password);
    return true;
  } catch {
    return false;
  } finally {
    await userClient.unbind();
  }
};

/**
 * Authenticate a user against LDAP. Returns the user object on success, or null on failure.
 * Throws on unexpected errors (e.g. connection failure).
 */
export const authenticateUser = async (
  ldapConfig: LdapConfig,
  username: string,
  password: string,
): Promise<Partial<db.User> | null> => {
  const usernameAttr = ldapConfig.usernameAttribute || 'uid';
  const emailAttr = ldapConfig.emailAttribute || 'mail';
  const displayNameAttr = ldapConfig.displayNameAttribute || 'cn';
  const titleAttr = ldapConfig.titleAttribute || 'title';

  const client = createClient(ldapConfig);

  try {
    // Step 1: STARTTLS upgrade if configured
    if (ldapConfig.starttls) {
      await client.startTLS(ldapConfig.tlsOptions || {});
    }

    // Step 2: Bind with service account to search for the user
    await client.bind(ldapConfig.bindDN, ldapConfig.bindPassword);

    // Step 3: Search for the user entry
    const entry = await searchUser(client, ldapConfig, username);
    if (!entry) {
      return null;
    }

    const userDN = entry.dn as string;

    // Step 4: Check user group membership
    const isMember = await isUserInGroup(client, ldapConfig, userDN, ldapConfig.userGroupDN);
    if (!isMember) {
      console.log(`ldap: user ${username} is not a member of ${ldapConfig.userGroupDN}`);
      return null;
    }

    // Step 5: Check admin group membership
    let isAdmin = false;
    try {
      isAdmin = await isUserInGroup(client, ldapConfig, userDN, ldapConfig.adminGroupDN);
    } catch (error: unknown) {
      handleErrorAndLog(error, 'Error checking admin group membership');
    }

    // Step 6: Unbind service account and verify user's password
    await client.unbind();

    const passwordValid = await verifyPassword(ldapConfig, userDN, password);
    if (!passwordValid) {
      return null;
    }

    // Step 7: Extract profile attributes and sync to database
    const userObj = {
      username: String(entry[usernameAttr] || username).toLowerCase(),
      email: String(entry[emailAttr] || '').toLowerCase(),
      admin: isAdmin,
      displayName: String(entry[displayNameAttr] || ''),
      title: String(entry[titleAttr] || ''),
    };

    console.log(`ldap: authenticated ${userObj.username}, admin=${isAdmin}`);

    await db.updateUser(userObj);

    return userObj;
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore unbind errors on cleanup
    }
  }
};

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  const ldapConfig = getLdapConfig();

  passport.use(
    type,
    new CustomStrategy(async (req: Request, done) => {
      const { username, password } = req.body;

      if (!username || !password) {
        return done(null, false);
      }

      try {
        const user = await authenticateUser(ldapConfig, username, password);
        return done(null, user || false);
      } catch (error: unknown) {
        const message = handleErrorAndLog(error, 'LDAP authentication error');
        return done(message);
      }
    }),
  );

  passport.serializeUser((user: Partial<db.User>, done) => {
    done(null, user.username);
  });

  passport.deserializeUser(async (username: string, done) => {
    try {
      const user = await db.findUser(username);
      done(null, user);
    } catch (error: unknown) {
      done(error, null);
    }
  });

  return passport;
};
