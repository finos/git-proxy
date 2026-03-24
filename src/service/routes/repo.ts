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

import express, { Request, Response } from 'express';

import * as db from '../../db';
import { getProxyURL } from '../urls';
import { getAllProxiedHosts } from '../../db';
import { RepoQuery } from '../../db/types';
import { isAdminUser, parsePaginationParams } from './utils';
import { Proxy } from '../../proxy';
import { handleErrorAndLog } from '../../utils/errors';

function repo(proxy: Proxy) {
  const router = express.Router();

  router.get('/', async (req: Request, res: Response) => {
    const proxyURL = getProxyURL(req);
    const query: Partial<RepoQuery> = {};
    const pagination = parsePaginationParams(req);

    for (const key in req.query) {
      if (!key || ['page', 'limit', 'search', 'sortBy', 'sortOrder'].includes(key)) continue;
      const rawValue = req.query[key] as string;
      let parsedValue: boolean | undefined;
      if (rawValue === 'false') parsedValue = false;
      if (rawValue === 'true') parsedValue = true;
      query[key] = parsedValue ?? rawValue;
    }

    const { data, total } = await db.getRepos(query, pagination);
    res.send({ data: data.map((d) => ({ ...d, proxyURL })), total });
  });

  router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const proxyURL = getProxyURL(req);
    const _id = req.params.id;
    const qd = await db.getRepoById(_id);
    res.send({ ...qd, proxyURL });
  });

  router.patch('/:id/user/push', async (req: Request<{ id: string }>, res: Response) => {
    if (!isAdminUser(req.user)) {
      res.status(401).send({
        message: 'You are not authorised to perform this action.',
      });
      return;
    }

    const _id = req.params.id;
    if (!req.body.username || typeof req.body.username !== 'string') {
      res.status(400).send({ error: 'Username is required' });
      return;
    }
    const username = req.body.username.toLowerCase();
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({ error: 'User does not exist' });
      return;
    }

    await db.addUserCanPush(_id, username);
    res.send({ message: 'created' });
  });

  router.patch('/:id/user/authorise', async (req: Request<{ id: string }>, res: Response) => {
    if (!isAdminUser(req.user)) {
      res.status(401).send({
        message: 'You are not authorised to perform this action.',
      });
      return;
    }

    const _id = req.params.id;
    if (!req.body.username || typeof req.body.username !== 'string') {
      res.status(400).send({ error: 'Username is required' });
      return;
    }
    const username = req.body.username.toLowerCase();
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({ error: 'User does not exist' });
      return;
    }

    await db.addUserCanAuthorise(_id, username);
    res.send({ message: 'created' });
  });

  router.delete(
    '/:id/user/authorise/:username',
    async (req: Request<{ id: string; username: string }>, res: Response) => {
      if (!isAdminUser(req.user)) {
        res.status(401).send({
          message: 'You are not authorised to perform this action.',
        });
        return;
      }

      const _id = req.params.id;
      const username = req.params.username;
      const user = await db.findUser(username);

      if (!user) {
        res.status(400).send({ error: 'User does not exist' });
        return;
      }

      await db.removeUserCanAuthorise(_id, username);
      res.send({ message: 'created' });
    },
  );

  router.delete(
    '/:id/user/push/:username',
    async (req: Request<{ id: string; username: string }>, res: Response) => {
      if (!isAdminUser(req.user)) {
        res.status(401).send({
          message: 'You are not authorised to perform this action.',
        });
        return;
      }

      const _id = req.params.id;
      const username = req.params.username;
      const user = await db.findUser(username);

      if (!user) {
        res.status(400).send({ error: 'User does not exist' });
        return;
      }

      await db.removeUserCanPush(_id, username);
      res.send({ message: 'created' });
    },
  );

  router.delete('/:id/delete', async (req: Request<{ id: string }>, res: Response) => {
    if (!isAdminUser(req.user)) {
      res.status(401).send({
        message: 'You are not authorised to perform this action.',
      });
      return;
    }

    const _id = req.params.id;

    // determine if we need to restart the proxy
    const previousHosts = await getAllProxiedHosts();
    await db.deleteRepo(_id);
    const currentHosts = await getAllProxiedHosts();

    if (currentHosts.length < previousHosts.length) {
      // restart the proxy
      console.log('Restarting the proxy to remove a host');
      await proxy.stop();
      await proxy.start();
    }

    res.send({ message: 'deleted' });
  });

  router.post('/', async (req: Request, res: Response) => {
    if (!isAdminUser(req.user)) {
      res.status(401).send({
        message: 'You are not authorised to perform this action.',
      });
      return;
    }

    if (!req.body.url) {
      res.status(400).send({
        message: 'Repository url is required',
      });
      return;
    }

    const repo = await db.getRepoByUrl(req.body.url);
    if (repo) {
      res.status(409).send({
        message: `Repository ${req.body.url} already exists!`,
      });
    } else {
      try {
        // figure out if this represent a new domain to proxy
        let newOrigin = true;

        const existingHosts = await getAllProxiedHosts();
        existingHosts.forEach((h) => {
          // assume SSL is in use and that our origins are missing the protocol
          if (req.body.url.startsWith(`https://${h}`)) {
            newOrigin = false;
          }
        });

        console.log(
          `API request to proxy repository ${req.body.url} is for a new origin: ${newOrigin},\n\texisting origin list was: ${JSON.stringify(existingHosts)}`,
        );

        // create the repository
        const repoDetails = await db.createRepo(req.body);
        const proxyURL = getProxyURL(req);

        // restart the proxy if we're proxying a new domain
        if (newOrigin) {
          console.log('Restarting the proxy to handle an additional host');
          await proxy.stop();
          await proxy.start();
        }

        // return data on the new repository (including it's _id and the proxyUrl)
        res.send({ ...repoDetails, proxyURL, message: 'created' });
      } catch (error: unknown) {
        const msg = handleErrorAndLog(error, 'Repository creation failed');
        res.status(500).send({ message: msg });
      }
    }
  });

  return router;
}

export default repo;
