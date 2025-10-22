import express, { Request, Response } from 'express';
const router = express.Router();

import * as db from '../../db';
import { toPublicUser } from './publicApi';

router.get('/', async (req: Request, res: Response) => {
  console.log('fetching users');
  const users = await db.getUsers();
  res.send(users.map(toPublicUser));
});

router.get('/:id', async (req: Request, res: Response) => {
  const username = req.params.id.toLowerCase();
  console.log(`Retrieving details for user: ${username}`);
  const user = await db.findUser(username);
  if (!user) {
    res.status(404).send('Error: User not found').end();
    return;
  }
  res.send(toPublicUser(user));
});

export default router;
