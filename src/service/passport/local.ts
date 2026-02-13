/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import bcrypt from 'bcryptjs';
import { Strategy as LocalStrategy } from 'passport-local';
import type { PassportStatic } from 'passport';
import * as db from '../../db';

export const type = 'local';

// Dynamic import to always get the current db module instance
// This is necessary for test environments where modules may be reset
const getDb = () => import('../../db');

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  passport.use(
    new LocalStrategy(
      async (
        username: string,
        password: string,
        done: (err: any, user?: any, info?: any) => void,
      ) => {
        try {
          const dbModule = await getDb();
          const user = await dbModule.findUser(username);
          if (!user) {
            return done(null, false, { message: 'Incorrect username.' });
          }

          const passwordCorrect = await bcrypt.compare(password, user.password ?? '');
          if (!passwordCorrect) {
            return done(null, false, { message: 'Incorrect password.' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.username);
  });

  passport.deserializeUser(async (username: string, done) => {
    try {
      const dbModule = await getDb();
      const user = await dbModule.findUser(username);
      done(null, user);
    } catch (err) {
      done(err, null);
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
      await db.createUser(username, password, email, type, isAdmin);
    }
  };

  await createIfNotExists('admin', 'admin', 'admin@place.com', 'none', true);
  await createIfNotExists('user', 'user', 'user@place.com', 'none', false);
};
