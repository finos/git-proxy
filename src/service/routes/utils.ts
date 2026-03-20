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

import { Request } from 'express';
import { PaginationOptions } from '../../db/types';
import { PublicUser, User as DbUser } from '../../db/types';

interface User extends Express.User {
  username: string;
  admin?: boolean;
}

export const parsePaginationParams = (req: Request, defaultLimit = 10): PaginationOptions => {
  const rawLimit = parseInt(req.query['limit'] as string, 10);
  const rawPage = parseInt(req.query['page'] as string, 10);

  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? defaultLimit : rawLimit));
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const skip = (page - 1) * limit;

  const pagination: PaginationOptions = { skip, limit };
  if (req.query['search']) pagination.search = req.query['search'] as string;
  if (req.query['sortBy']) pagination.sortBy = req.query['sortBy'] as string;
  if (req.query['sortOrder'])
    pagination.sortOrder = req.query['sortOrder'] === 'desc' ? 'desc' : 'asc';
  return pagination;
};

export function isAdminUser(user?: Express.User): user is User & { admin: true } {
  return user !== null && user !== undefined && (user as User).admin === true;
}

export const toPublicUser = (user: DbUser): PublicUser => {
  return {
    username: user.username || '',
    displayName: user.displayName || '',
    email: user.email || '',
    title: user.title || '',
    gitAccount: user.gitAccount || '',
    admin: user.admin || false,
  };
};
