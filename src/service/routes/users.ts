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
const router = express.Router();

import * as db from '../../db';
import { toPublicUser } from './utils';

router.get('/', async (req: Request, res: Response) => {
  console.log('fetching users');
  const [users, activityCounts] = await Promise.all([
    db.getUsers(),
    db.getUserActivityTabCountsByUsername(),
  ]);
  res.send(
    users.map((u) => {
      const pub = toPublicUser(u);
      const activity = activityCounts.get(u.username.toLowerCase());
      return activity ? { ...pub, activity } : pub;
    }),
  );
});

router.get('/:id/activity', async (req: Request<{ id: string }>, res: Response) => {
  const username = req.params.id.toLowerCase();
  if (!(await db.findUser(username))) {
    res
      .status(404)
      .send({ message: `User ${username} not found` })
      .end();
    return;
  }
  const pushes = await db.getPushesForUserProfile(username);
  res.send(pushes);
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const username = req.params.id.toLowerCase();
  console.log(`Retrieving details for user: ${username}`);
  const user = await db.findUser(username);
  if (!user) {
    res
      .status(404)
      .send({
        message: `User ${username} not found`,
      })
      .end();
    return;
  }
  res.send(toPublicUser(user));
});

export default router;
