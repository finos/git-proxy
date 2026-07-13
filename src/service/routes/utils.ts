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

import { PublicUser, User as DbUser } from '../../db/types';

interface User extends Express.User {
  username: string;
  admin?: boolean;
  mustChangePassword?: boolean;
}

export function isAdminUser(user?: Express.User): user is User & { admin: true } {
  return user !== null && user !== undefined && (user as User).admin === true;
}

export const toPublicUser = (user: DbUser): PublicUser => {
  const publicUser: PublicUser = {
    username: user.username || '',
    displayName: user.displayName || '',
    email: user.email || '',
    title: user.title || '',
    gitAccount: user.gitAccount || '',
    admin: user.admin || false,
  };
  if (user.mustChangePassword) {
    publicUser.mustChangePassword = true;
  }
  return publicUser;
};

export const mustChangePassword = (user?: Express.User): boolean => {
  return user !== null && user !== undefined && (user as User).mustChangePassword === true;
};
