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

import { z } from 'zod';

import * as db from '../../../db';
import { getAllProxiedHosts } from '../../../db';
import { Repo, RepoQuery } from '../../../db/types';
import { AuthorisedRepo } from '../../../config/generated/config';
import { handleErrorAndLog } from '../../../utils/errors';
import { getProxyURL } from '../../urls';
import { getCachedScmRepositoryMetadata, SCMRepositoryMetadata } from '../../scmMetadata';
import { pub } from '../base';
import { isAdminUser } from '../context';
import { errorKeyError, MessageBody, messageError, withBody } from '../errors';
import { docOnly, FilterQuery, RepoSchema, ScmMetadataSchema } from '../schemas';

const IdParams = z.object({ id: z.string() });
const IdUsernameParams = z.object({ id: z.string(), username: z.string() });
const UsernameBody = z.looseObject({ username: z.string().optional() }).optional();

const notAuthorised = { message: 'You are not authorised to perform this action.' };

const adminErrors = {
  UNAUTHORIZED: messageError(401, notAuthorised.message),
};

const userErrors = {
  ...adminErrors,
  BAD_REQUEST: errorKeyError(400, 'User does not exist'),
};

const userDoesNotExist = { error: 'User does not exist' };

type RepoWithProxyURL = Partial<Repo> & { proxyURL: string };

const list = pub
  .route({ method: 'GET', path: '/', summary: 'List repositories' })
  .input(z.object({ query: FilterQuery }))
  .output(docOnly<RepoWithProxyURL[]>(z.array(RepoSchema)))
  .handler(async ({ context }) => {
    const proxyURL = getProxyURL(context.req);
    const query: Partial<RepoQuery> = {};

    // Express's own query parser, so repeated and bracketed keys behave as before.
    const reqQuery = context.req.query;
    for (const key in reqQuery) {
      if (!key) continue;
      if (key === 'limit' || key === 'skip') continue;

      const rawValue = reqQuery[key];
      let parsedValue: boolean | undefined;
      if (rawValue === 'false') parsedValue = false;
      if (rawValue === 'true') parsedValue = true;
      query[key] = parsedValue ?? rawValue?.toString();
    }

    const qd = await db.getRepos(query);
    return qd.map((d) => ({ ...d, proxyURL }));
  });

const scmMetadata = pub
  .route({ method: 'GET', path: '/{id}/scm-metadata', summary: 'SCM metadata for a repository' })
  .errors({ NOT_FOUND: messageError(404, 'Repository not found') })
  .input(z.object({ params: IdParams }))
  .output(docOnly<SCMRepositoryMetadata | null>(ScmMetadataSchema))
  .handler(async ({ input, errors }) => {
    const _id = input.params.id;
    const qd = await db.getRepoById(_id);
    if (!qd) {
      throw withBody(errors.NOT_FOUND, { message: 'Repository not found' });
    }
    return getCachedScmRepositoryMetadata(qd.project, qd.name, qd.url);
  });

const get = pub
  .route({ method: 'GET', path: '/{id}', summary: 'Get a repository' })
  .input(z.object({ params: IdParams }))
  .output(docOnly<RepoWithProxyURL>(RepoSchema))
  .handler(async ({ context, input }) => {
    const proxyURL = getProxyURL(context.req);
    const _id = input.params.id;
    const qd = await db.getRepoById(_id);
    return { ...qd, proxyURL };
  });

const addPushUser = pub
  .route({ method: 'PATCH', path: '/{id}/user/push', summary: 'Allow a user to push' })
  .errors(userErrors)
  .input(z.object({ params: IdParams, body: UsernameBody }))
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!isAdminUser(context.req.user)) {
      throw withBody(errors.UNAUTHORIZED, notAuthorised);
    }

    const _id = input.params.id;
    // A missing username throws, which Express answers with a 500 as before.
    const username = (input.body?.username as string).toLowerCase();
    const user = await db.findUser(username);

    if (!user) {
      throw withBody(errors.BAD_REQUEST, userDoesNotExist);
    }

    await db.addUserCanPush(_id, username);
    return { message: 'created' };
  });

const addAuthoriseUser = pub
  .route({ method: 'PATCH', path: '/{id}/user/authorise', summary: 'Allow a user to approve' })
  .errors(userErrors)
  .input(z.object({ params: IdParams, body: UsernameBody }))
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!isAdminUser(context.req.user)) {
      throw withBody(errors.UNAUTHORIZED, notAuthorised);
    }

    const _id = input.params.id;
    const username = input.body?.username as string;
    const user = await db.findUser(username);

    if (!user) {
      throw withBody(errors.BAD_REQUEST, userDoesNotExist);
    }

    await db.addUserCanAuthorise(_id, username);
    return { message: 'created' };
  });

const removeAuthoriseUser = pub
  .route({
    method: 'DELETE',
    path: '/{id}/user/authorise/{username}',
    summary: 'Revoke a user’s approval permission',
  })
  .errors(userErrors)
  .input(z.object({ params: IdUsernameParams }))
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!isAdminUser(context.req.user)) {
      throw withBody(errors.UNAUTHORIZED, notAuthorised);
    }

    const _id = input.params.id;
    const username = input.params.username;
    const user = await db.findUser(username);

    if (!user) {
      throw withBody(errors.BAD_REQUEST, userDoesNotExist);
    }

    await db.removeUserCanAuthorise(_id, username);
    return { message: 'created' };
  });

const removePushUser = pub
  .route({
    method: 'DELETE',
    path: '/{id}/user/push/{username}',
    summary: 'Revoke a user’s push permission',
  })
  .errors(userErrors)
  .input(z.object({ params: IdUsernameParams }))
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!isAdminUser(context.req.user)) {
      throw withBody(errors.UNAUTHORIZED, notAuthorised);
    }

    const _id = input.params.id;
    const username = input.params.username;
    const user = await db.findUser(username);

    if (!user) {
      throw withBody(errors.BAD_REQUEST, userDoesNotExist);
    }

    await db.removeUserCanPush(_id, username);
    return { message: 'created' };
  });

const remove = pub
  .route({ method: 'DELETE', path: '/{id}/delete', summary: 'Delete a repository' })
  .errors(adminErrors)
  .input(z.object({ params: IdParams }))
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!isAdminUser(context.req.user)) {
      throw withBody(errors.UNAUTHORIZED, notAuthorised);
    }

    const _id = input.params.id;

    // determine if we need to restart the proxy
    const previousHosts = await getAllProxiedHosts();
    await db.deleteRepo(_id);
    const currentHosts = await getAllProxiedHosts();

    if (currentHosts.length < previousHosts.length) {
      // restart the proxy
      console.log('Restarting the proxy to remove a host');
      await context.proxy.stop();
      await context.proxy.start();
    }

    return { message: 'deleted' };
  });

const create = pub
  .route({ method: 'POST', path: '/', summary: 'Register a repository' })
  .errors({
    ...adminErrors,
    BAD_REQUEST: messageError(400, 'Repository url is required'),
    CONFLICT: messageError(409),
    INTERNAL_SERVER_ERROR: messageError(500),
  })
  .input(
    z.object({
      body: z
        .looseObject({
          url: z.string().optional(),
          name: z.string().optional(),
          project: z.string().optional(),
        })
        .optional(),
    }),
  )
  .output(
    docOnly<RepoWithProxyURL & { message: string }>(RepoSchema.extend({ message: z.string() })),
  )
  .handler(async ({ context, input, errors }) => {
    if (!isAdminUser(context.req.user)) {
      throw withBody(errors.UNAUTHORIZED, notAuthorised);
    }

    const body = input.body;
    if (!body?.url) {
      throw withBody(errors.BAD_REQUEST, { message: 'Repository url is required' });
    }
    const url = body.url;

    const repo = await db.getRepoByUrl(url);
    if (repo) {
      throw withBody(errors.CONFLICT, { message: `Repository ${url} already exists!` });
    }

    try {
      // figure out if this represent a new domain to proxy
      let newOrigin = true;

      const existingHosts = await getAllProxiedHosts();
      existingHosts.forEach((h) => {
        // assume SSL is in use and that our origins are missing the protocol
        if (url.startsWith(`https://${h}`)) {
          newOrigin = false;
        }
      });

      console.log(
        `API request to proxy repository ${url} is for a new origin: ${newOrigin},\n\texisting origin list was: ${JSON.stringify(existingHosts)}`,
      );

      // create the repository
      const repoDetails = await db.createRepo(body as AuthorisedRepo);
      const proxyURL = getProxyURL(context.req);

      // restart the proxy if we're proxying a new domain
      if (newOrigin) {
        console.log('Restarting the proxy to handle an additional host');
        await context.proxy.stop();
        await context.proxy.start();
      }

      // return data on the new repository (including it's _id and the proxyUrl)
      return { ...repoDetails, proxyURL, message: 'created' };
    } catch (error: unknown) {
      const msg = handleErrorAndLog(error, 'Repository creation failed');
      throw withBody(errors.INTERNAL_SERVER_ERROR, { message: msg });
    }
  });

export const repoRouter = {
  list,
  scmMetadata,
  get,
  addPushUser,
  addAuthoriseUser,
  removeAuthoriseUser,
  removePushUser,
  delete: remove,
  create,
};
