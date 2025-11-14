import express, { Request, Response } from 'express';
import { utils } from 'ssh2';

import * as db from '../../db';
import { toPublicUser } from './publicApi';
import { DuplicateSSHKeyError, UserNotFoundError } from '../../errors/DatabaseErrors';

const router = express.Router();
const parseKey = utils.parseKey;

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
    res.status(401).json({ error: 'Login required' });
    return;
  }

  const { username, admin } = req.user as { username: string; admin: boolean };
  const targetUsername = req.params.username.toLowerCase();

  // Admins can add to any account, users can only add to their own
  if (username !== targetUsername && !admin) {
    res.status(403).json({ error: 'Not authorized to add keys for this user' });
    return;
  }

  const { publicKey } = req.body;
  if (!publicKey || typeof publicKey !== 'string') {
    res.status(400).json({ error: 'Public key is required' });
    return;
  }

  try {
    const parsedKey = parseKey(publicKey.trim());

    if (parsedKey instanceof Error) {
      res.status(400).json({ error: `Invalid SSH key: ${parsedKey.message}` });
      return;
    }

    if (parsedKey.isPrivateKey()) {
      res.status(400).json({ error: 'Invalid SSH key: Must be a public key' });
      return;
    }

    const keyWithoutComment = parsedKey.getPublicSSH().toString('utf8');
    console.log('Adding SSH key', { targetUsername, keyWithoutComment });
    await db.addPublicKey(targetUsername, keyWithoutComment);
    res.status(201).json({ message: 'SSH key added successfully' });
  } catch (error) {
    console.error('Error adding SSH key:', error);

    if (error instanceof DuplicateSSHKeyError) {
      res.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to add SSH key: ${errorMessage}` });
  }
});

// Remove SSH public key
router.delete('/:username/ssh-keys', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Login required' });
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
