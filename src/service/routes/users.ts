// src/service/routes/users.ts

import express, { Request, Response } from 'express';
import * as db from '../../db';
import { User } from '../../db/types'; // adjust this import path to your actual User type

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const query: Record<string, unknown> = {};

  console.log(`Fetching users with query: ${JSON.stringify(req.query)}`);
  for (const k in req.query) {
    if (!k || k === 'limit' || k === 'skip') continue;

    let v = req.query[k];
    if (v === 'false') v = false as any;
    if (v === 'true') v = true as any;
    query[k] = v;
  }

  try {
    const users = await db.getUsers(query);
    res.send(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).send({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: any) => {
  const username = req.params.id.toLowerCase();
  console.log(`Retrieving details for user: ${username}`);

  try {
    const data = await db.findUser(username);

    if (!data) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Clone and sanitize user data
    const user: Partial<User> = { ...JSON.parse(JSON.stringify(data)) };
    if ('password' in user) delete user.password;

    res.send(user);
  } catch (err) {
    console.error('Error retrieving user:', err);
    res.status(500).send({ message: 'Internal server error' });
  }
});

export default router;
