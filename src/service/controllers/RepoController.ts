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

import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Request,
  Res,
  Route,
  Security,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import * as db from '../../db';
import { RepoQuery } from '../../db/types';
import { getProxyURL } from '../urls';
import { isAdminUser } from '../routes/utils';
import { getProxy } from '../proxyStore';
import { handleErrorAndLog } from '../../utils/errors';
import { MessageResponse } from '../interfaces/common.interfaces';
import { UsernameBody, CreateRepoBody, RepoWithProxy } from '../interfaces/repo.interfaces';
import {
  ConflictResponse,
  InternalServerErrorResponse,
  NotFoundResponse,
  UnauthorisedResponse,
  UserNotFoundResponse,
  ValidationErrorResponse,
} from '../decorators/response.types';

/**
 * Repository management.
 */
@Route('api/v1/repo')
@Security('jwt')
@Tags('Repositories')
export class RepoController extends Controller {
  /**
   * Returns repositories, optionally filtered by query parameters.
   */
  @Get('/')
  public async getRepos(@Request() req: ExpressRequest): Promise<RepoWithProxy[]> {
    const proxyURL = getProxyURL(req);
    const query: Partial<RepoQuery> = {};

    for (const key in req.query) {
      if (!key) continue;
      if (key === 'limit' || key === 'skip') continue;

      const rawValue = req.query[key];
      let parsedValue: boolean | undefined;
      if (rawValue === 'false') parsedValue = false;
      if (rawValue === 'true') parsedValue = true;
      query[key] = parsedValue ?? rawValue?.toString();
    }

    const repos = await db.getRepos(query);
    return repos.map((d) => ({ ...d, proxyURL }));
  }

  /**
   * Returns a single repository by ID.
   */
  @Get('/{id}')
  public async getRepo(
    @Path() id: string,
    @Request() req: ExpressRequest,
    @Res() notFoundResponse: NotFoundResponse,
  ): Promise<RepoWithProxy> {
    const proxyURL = getProxyURL(req);
    const repo = await db.getRepoById(id);
    if (!repo) {
      return notFoundResponse(404, { message: `Repository ${id} not found` });
    }
    return { ...repo, proxyURL };
  }

  /**
   * Creates a new repository. May restart the proxy if a new origin is added.
   */
  @Post('/')
  public async createRepo(
    @Body() body: CreateRepoBody,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
    @Res() validationErrorResponse: ValidationErrorResponse,
    @Res() conflictResponse: ConflictResponse,
    @Res() internalServerErrorResponse: InternalServerErrorResponse,
  ): Promise<RepoWithProxy & MessageResponse> {
    if (!isAdminUser(req.user)) {
      return unauthorisedResponse(401, {
        message: 'You are not authorised to perform this action.',
      });
    }

    const repoUrl = body.url;

    if (!repoUrl) {
      return validationErrorResponse(400, { message: 'Repository url is required' });
    }

    const existing = await db.getRepoByUrl(repoUrl);
    if (existing) {
      return conflictResponse(409, { message: `Repository ${repoUrl} already exists!` });
    }

    try {
      // figure out if this represent a new domain to proxy
      let newOrigin = true;

      const existingHosts = await db.getAllProxiedHosts();
      existingHosts.forEach((h) => {
        // assume SSL is in use and that our origins are missing the protocol
        if (repoUrl.startsWith(`https://${h}`)) {
          newOrigin = false;
        }
      });

      console.log(
        `API request to proxy repository ${repoUrl} is for a new origin: ${newOrigin},\n\texisting origin list was: ${JSON.stringify(existingHosts)}`,
      );

      const repoDetails = await db.createRepo(body);
      const proxyURL = getProxyURL(req);

      // restart the proxy if we're proxying a new domain
      if (newOrigin) {
        console.log('Restarting the proxy to handle an additional host');
        const proxy = getProxy();
        await proxy.stop();
        await proxy.start();
      }

      return { ...repoDetails, proxyURL, message: 'created' };
    } catch (error: unknown) {
      const msg = handleErrorAndLog(error, 'Repository creation failed');
      return internalServerErrorResponse(500, { message: msg });
    }
  }

  /**
   * Grants a user push permission on a repository.
   */
  @Patch('/{id}/user/push')
  public async addPushUser(
    @Path() id: string,
    @Body() body: UsernameBody,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
    @Res() userNotFoundResponse: UserNotFoundResponse,
  ): Promise<MessageResponse> {
    if (!isAdminUser(req.user)) {
      return unauthorisedResponse(401, {
        message: 'You are not authorised to perform this action.',
      });
    }

    const username = body.username.toLowerCase();
    const user = await db.findUser(username);
    if (!user) {
      return userNotFoundResponse(400, { error: 'User does not exist' });
    }

    await db.addUserCanPush(id, username);
    return { message: 'created' };
  }

  /**
   * Grants a user authorise permission on a repository.
   */
  @Patch('/{id}/user/authorise')
  public async addAuthoriseUser(
    @Path() id: string,
    @Body() body: UsernameBody,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
    @Res() userNotFoundResponse: UserNotFoundResponse,
  ): Promise<MessageResponse> {
    if (!isAdminUser(req.user)) {
      return unauthorisedResponse(401, {
        message: 'You are not authorised to perform this action.',
      });
    }

    const user = await db.findUser(body.username);
    if (!user) {
      return userNotFoundResponse(400, { error: 'User does not exist' });
    }

    await db.addUserCanAuthorise(id, body.username);
    return { message: 'created' };
  }

  /**
   * Revokes a user's authorise permission on a repository.
   */
  @Delete('/{id}/user/authorise/{username}')
  public async removeAuthoriseUser(
    @Path() id: string,
    @Path() username: string,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
    @Res() userNotFoundResponse: UserNotFoundResponse,
  ): Promise<MessageResponse> {
    if (!isAdminUser(req.user)) {
      return unauthorisedResponse(401, {
        message: 'You are not authorised to perform this action.',
      });
    }

    const user = await db.findUser(username);
    if (!user) {
      return userNotFoundResponse(400, { error: 'User does not exist' });
    }

    await db.removeUserCanAuthorise(id, username);
    return { message: 'created' };
  }

  /**
   * Revokes a user's push permission on a repository.
   */
  @Delete('/{id}/user/push/{username}')
  public async removePushUser(
    @Path() id: string,
    @Path() username: string,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
    @Res() userNotFoundResponse: UserNotFoundResponse,
  ): Promise<MessageResponse> {
    if (!isAdminUser(req.user)) {
      return unauthorisedResponse(401, {
        message: 'You are not authorised to perform this action.',
      });
    }

    const user = await db.findUser(username);
    if (!user) {
      return userNotFoundResponse(400, { error: 'User does not exist' });
    }

    await db.removeUserCanPush(id, username);
    return { message: 'created' };
  }

  /**
   * Deletes a repository. May restart the proxy if a proxied host is removed.
   */
  @Delete('/{id}/delete')
  public async deleteRepo(
    @Path() id: string,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
  ): Promise<MessageResponse> {
    if (!isAdminUser(req.user)) {
      return unauthorisedResponse(401, {
        message: 'You are not authorised to perform this action.',
      });
    }

    // determine if we need to restart the proxy
    const previousHosts = await db.getAllProxiedHosts();
    await db.deleteRepo(id);
    const currentHosts = await db.getAllProxiedHosts();

    if (currentHosts.length < previousHosts.length) {
      console.log('Restarting the proxy to remove a host');
      const proxy = getProxy();
      await proxy.stop();
      await proxy.start();
    }

    return { message: 'deleted' };
  }
}
