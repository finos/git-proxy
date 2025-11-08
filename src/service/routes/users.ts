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

// Add SSH public key
router.post('/:username/ssh-keys', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { username, admin } = req.user as { username: string; admin: boolean };
  const targetUsername = req.params.username.toLowerCase();

  // Only allow users to add keys to their own account, or admins to add to any account
  if (username !== targetUsername && !admin) {
    res.status(403).json({ error: 'Not authorized to add keys for this user' });
    return;
  }

  const { publicKey } = req.body;
  if (!publicKey) {
    res.status(400).json({ error: 'Public key is required' });
    return;
  }

  // Strip the comment from the key (everything after the last space)
  const keyWithoutComment = publicKey.split(' ').slice(0, 2).join(' ');

  console.log('Adding SSH key', { targetUsername, keyWithoutComment });
  try {
    await db.addPublicKey(targetUsername, keyWithoutComment);
    res.status(201).json({ message: 'SSH key added successfully' });
  } catch (error) {
    console.error('Error adding SSH key:', error);
    res.status(500).json({ error: 'Failed to add SSH key' });
  }
});

// Remove SSH public key
router.delete('/:username/ssh-keys', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { username, admin } = req.user as { username: string; admin: boolean };
  const targetUsername = req.params.username.toLowerCase();

  // Only allow users to remove keys from their own account, or admins to remove from any account
  if (username !== targetUsername && !admin) {
    res.status(403).json({ error: 'Not authorized to remove keys for this user' });
    return;
  }

  const { publicKey } = req.body;
  if (!publicKey) {
    res.status(400).json({ error: 'Public key is required' });
    return;
  }

  try {
    await db.removePublicKey(targetUsername, publicKey);
    res.status(200).json({ message: 'SSH key removed successfully' });
  } catch (error) {
    console.error('Error removing SSH key:', error);
    res.status(500).json({ error: 'Failed to remove SSH key' });
  }
});

export default router;
