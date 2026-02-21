import express, { Request, Response } from 'express';

import * as db from '../../db';
import { getProxyURL } from '../urls';
import { getAllProxiedHosts } from '../../db';
import { RepoQuery } from '../../db/types';
import { isAdminUser } from './utils';
import { Proxy } from '../../proxy';
import { handleAndLogError } from '../../utils/errors';

function repo(proxy: Proxy) {
  const router = express.Router();

  router.get('/', async (req: Request, res: Response) => {
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

    const qd = await db.getRepos(query);
    res.send(qd.map((d) => ({ ...d, proxyURL })));
  });

  router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const proxyURL = getProxyURL(req);
    const _id = req.params.id;
    const qd = await db.getRepoById(_id);
    res.send({ ...qd, proxyURL });
  });

  router.patch('/:id/user/push', async (req: Request<{ id: string }>, res: Response) => {
    if (isAdminUser(req.user)) {
      const _id = req.params.id;
      const username = req.body.username.toLowerCase();
      const user = await db.findUser(username);

      if (!user) {
        res.status(400).send({ error: 'User does not exist' });
        return;
      }

      await db.addUserCanPush(_id, username);
      res.send({ message: 'created' });
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  router.patch('/:id/user/authorise', async (req: Request<{ id: string }>, res: Response) => {
    if (isAdminUser(req.user)) {
      const _id = req.params.id;
      const username = req.body.username;
      const user = await db.findUser(username);

      if (!user) {
        res.status(400).send({ error: 'User does not exist' });
        return;
      }

      await db.addUserCanAuthorise(_id, username);
      res.send({ message: 'created' });
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  router.delete(
    '/:id/user/authorise/:username',
    async (req: Request<{ id: string; username: string }>, res: Response) => {
      if (isAdminUser(req.user)) {
        const _id = req.params.id;
        const username = req.params.username;
        const user = await db.findUser(username);

        if (!user) {
          res.status(400).send({ error: 'User does not exist' });
          return;
        }

        await db.removeUserCanAuthorise(_id, username);
        res.send({ message: 'created' });
      } else {
        res.status(401).send({
          message: 'You are not authorised to perform this action...',
        });
      }
    },
  );

  router.delete(
    '/:id/user/push/:username',
    async (req: Request<{ id: string; username: string }>, res: Response) => {
      if (isAdminUser(req.user)) {
        const _id = req.params.id;
        const username = req.params.username;
        const user = await db.findUser(username);

        if (!user) {
          res.status(400).send({ error: 'User does not exist' });
          return;
        }

        await db.removeUserCanPush(_id, username);
        res.send({ message: 'created' });
      } else {
        res.status(401).send({
          message: 'You are not authorised to perform this action...',
        });
      }
    },
  );

  router.delete('/:id/delete', async (req: Request<{ id: string }>, res: Response) => {
    if (isAdminUser(req.user)) {
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
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    if (isAdminUser(req.user)) {
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
          const msg = handleAndLogError(error, 'Repository creation failed');
          res.status(500).send({ message: msg });
        }
      }
    }
  });

  return router;
}

export default repo;
