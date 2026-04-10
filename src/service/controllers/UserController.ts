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

import { Controller, Get, Path, Res, Route, Security, Tags, TsoaResponse } from 'tsoa';
import * as db from '../../db';
import { PublicUser } from '../../db/types';
import { toPublicUser } from '../routes/utils';

/**
 * User listing (JWT-protected).
 */
@Route('api/v1/user')
@Security('jwt')
@Tags('Users')
export class UserController extends Controller {
  /**
   * Returns all registered users (public fields only).
   */
  @Get('/')
  public async getUsers(): Promise<PublicUser[]> {
    console.log('fetching users');
    const users = await db.getUsers();
    return users.map(toPublicUser);
  }

  /**
   * Returns a single user by username.
   */
  @Get('/{id}')
  public async getUser(
    @Path() id: string,
    @Res() notFoundResponse: TsoaResponse<404, { message: string }>,
  ): Promise<PublicUser> {
    const username = id.toLowerCase();
    console.log(`Retrieving details for user: ${username}`);
    const user = await db.findUser(username);
    if (!user) {
      return notFoundResponse(404, { message: `User ${username} not found` });
    }
    return toPublicUser(user);
  }
}
