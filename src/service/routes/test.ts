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

/**
 * Test-only endpoints for E2E test data cleanup.
 * Gated by NODE_ENV === 'test' so they are never exposed in production.
 */

import express, { Request, Response } from 'express';
import * as db from '../../db';
import { isAdminUser } from './utils';

const router = express.Router();

// Helper: check that the authenticated user is an admin
function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdminUser(req.user)) {
    res.status(403).send({ message: 'Admin access required' });
    return false;
  }
  return true;
}

router.delete('/push/:id', async (req: Request<{ id: string }>, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    await db.deletePush(req.params.id);
    res.send({ message: `Push ${req.params.id} deleted` });
  } catch (err: any) {
    res.status(500).send({ message: err.message || 'Failed to delete push' });
  }
});

router.delete('/user/:username', async (req: Request<{ username: string }>, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    await db.deleteUser(req.params.username);
    res.send({ message: `User ${req.params.username} deleted` });
  } catch (err: any) {
    res.status(500).send({ message: err.message || 'Failed to delete user' });
  }
});

export default router;
