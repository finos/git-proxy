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

import bcrypt from 'bcryptjs';
import { IVerifyOptions, Strategy as LocalStrategy } from 'passport-local';
import type { PassportStatic } from 'passport';
import * as db from '../../db';
import type { DefaultLocalUser } from './types';
export const type = 'local';

const DEFAULT_LOCAL_USERS: DefaultLocalUser[] = [
  {
    username: 'admin',
    password: 'admin',
    email: 'admin@place.com',
    gitAccount: 'none',
    admin: true,
  },
  {
    username: 'user',
    password: 'user',
    email: 'user@place.com',
    gitAccount: 'none',
    admin: false,
  },
];

const isProduction = (): boolean => process.env.NODE_ENV === 'production';
const isKnownDefaultCredentialAttempt = (username: string, password: string): boolean =>
  DEFAULT_LOCAL_USERS.some(
    (defaultUser) =>
      defaultUser.username.toLowerCase() === username.toLowerCase() &&
      defaultUser.password === password,
  );

// Dynamic import to always get the current db module instance
// This is necessary for test environments where modules may be reset
const getDb = () => import('../../db');

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  passport.use(
    new LocalStrategy(
      async (
        username: string,
        password: string,
        done: (err: unknown, user?: Partial<db.User>, info?: IVerifyOptions) => void,
      ) => {
        try {
          const dbModule = await getDb();
          const user = await dbModule.findUser(username);
          if (!user) {
            return done(null, undefined, { message: 'Incorrect username.' });
          }

          const passwordCorrect = await bcrypt.compare(password, user.password ?? '');
          if (!passwordCorrect) {
            return done(null, undefined, { message: 'Incorrect password.' });
          }

          // Force password reset when using default accounts in production
          if (
            isProduction() &&
            isKnownDefaultCredentialAttempt(username, password) &&
            !user.mustChangePassword
          ) {
            user.mustChangePassword = true;
            await dbModule.updateUser({
              username: user.username,
              mustChangePassword: true,
            });
          }

          return done(null, user);
        } catch (error: unknown) {
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user: Partial<db.User>, done) => {
    done(null, user.username);
  });

  passport.deserializeUser(async (username: string, done) => {
    try {
      const dbModule = await getDb();
      const user = await dbModule.findUser(username);
      done(null, user);
    } catch (error: unknown) {
      done(error, null);
    }
  });

  return passport;
};

/**
 * Create the default admin and regular test users.
 */
export const createDefaultAdmin = async () => {
  const createIfNotExists = async (
    username: string,
    password: string,
    email: string,
    type: string,
    isAdmin: boolean,
  ) => {
    const user = await db.findUser(username);
    if (!user) {
      await db.createUser(username, password, email, type, isAdmin, '', isProduction());
    }
  };

  for (const u of DEFAULT_LOCAL_USERS) {
    await createIfNotExists(u.username, u.password, u.email, u.gitAccount, u.admin);
  }
};
