import express, { Request, Response } from 'express';
const router = express.Router();

import * as db from '../../db';
import { toPublicUser } from './publicApi';
import { UserQuery } from '../../db/types';

router.get('/', async (req: Request, res: Response) => {
  const query: Partial<UserQuery> = {};

  console.log(`fetching users = query path =${JSON.stringify(req.query)}`);
  for (const k in req.query) {
    if (!k) continue;
    if (k === 'limit' || k === 'skip') continue;

    const rawValue = req.query[k];
    let parsedValue: boolean | undefined;
    if (rawValue === 'false') parsedValue = false;
    if (rawValue === 'true') parsedValue = true;
    query[k] = parsedValue ?? rawValue?.toString();
  }

  const users = await db.getUsers(query);
  res.send(users.map(toPublicUser));
});

router.get('/:id', async (req: Request, res: Response) => {
  const username = req.params.id.toLowerCase();
  console.log(`Retrieving details for user: ${username}`);
  const user = await db.findUser(username);
  res.send(toPublicUser(user));
});

export default router;
