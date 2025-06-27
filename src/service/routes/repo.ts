import express, { Request, Response } from 'express';
import * as db from '../../db';
import { getProxyURL } from '../urls';
import { AuthenticatedRequest } from './types';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const proxyURL = getProxyURL(req);
  const query: Record<string, unknown> = {};

  for (const k in req.query) {
    if (!k || k === 'limit' || k === 'skip') continue;
    let v = req.query[k];
    if (v === 'false') v = false as any;
    if (v === 'true') v = true as any;
    query[k] = v;
  }

  const repos = await db.getRepos(query);
  res.send(repos.map((r: any) => ({ ...r, proxyURL })));
});

router.get('/:name', async (req: Request, res: Response) => {
  const proxyURL = getProxyURL(req);
  const name = req.params.name;
  const repo = await db.getRepo(name);
  res.send({ ...repo, proxyURL });
});

router.patch('/:name/user/push', async (req: AuthenticatedRequest, res: any) => {
  if (req.user?.admin) {
    const repoName = req.params.name;
    const username = req.body.username.toLowerCase();
    const user = await db.findUser(username);

    if (!user) return res.status(400).send({ error: 'User does not exist' });

    await db.addUserCanPush(repoName, username);
    return res.send({ message: 'created' });
  }

  res.status(401).send({ message: 'You are not authorised to perform this action...' });
});

router.patch('/:name/user/authorise', async (req: AuthenticatedRequest, res: any) => {
  if (req.user?.admin) {
    const repoName = req.params.name;
    const username = req.body.username;
    const user = await db.findUser(username);

    if (!user) return res.status(400).send({ error: 'User does not exist' });

    await db.addUserCanAuthorise(repoName, username);
    return res.send({ message: 'created' });
  }

  res.status(401).send({ message: 'You are not authorised to perform this action...' });
});

router.delete('/:name/user/authorise/:username', async (req: AuthenticatedRequest, res: any) => {
  if (req.user?.admin) {
    const repoName = req.params.name;
    const username = req.params.username;
    const user = await db.findUser(username);

    if (!user) return res.status(400).send({ error: 'User does not exist' });

    await db.removeUserCanAuthorise(repoName, username);
    return res.send({ message: 'created' });
  }

  res.status(401).send({ message: 'You are not authorised to perform this action...' });
});

router.delete('/:name/user/push/:username', async (req: AuthenticatedRequest, res: any) => {
  if (req.user?.admin) {
    const repoName = req.params.name;
    const username = req.params.username;
    const user = await db.findUser(username);

    if (!user) return res.status(400).send({ error: 'User does not exist' });

    await db.removeUserCanPush(repoName, username);
    return res.send({ message: 'created' });
  }

  res.status(401).send({ message: 'You are not authorised to perform this action...' });
});

router.delete('/:name/delete', async (req: AuthenticatedRequest, res: any) => {
  if (req.user?.admin) {
    const repoName = req.params.name;
    await db.deleteRepo(repoName);
    return res.send({ message: 'deleted' });
  }

  res.status(401).send({ message: 'You are not authorised to perform this action...' });
});

router.post('/', async (req: AuthenticatedRequest, res: any) => {
  if (req.user?.admin) {
    const repoName = req.body.name;
    if (!repoName) {
      return res.status(400).send({ message: 'Repository name is required' });
    }

    const repo = await db.getRepo(repoName);
    if (repo) {
      return res.status(409).send({ message: 'Repository already exists!' });
    }

    try {
      await db.createRepo(req.body);
      return res.send({ message: 'created' });
    } catch (error) {
      console.error('Failed to create repository:', error);
      return res.status(500).send({ message: 'Failed to create repository' });
    }
  }

  res.status(401).send({ message: 'You are not authorised to perform this action...' });
});

export default router;
