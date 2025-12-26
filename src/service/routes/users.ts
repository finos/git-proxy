import express, { Request, Response } from 'express';
import { utils } from 'ssh2';
import crypto from 'crypto';

import * as db from '../../db';
import { toPublicUser } from './utils';

const router = express.Router();

// Calculate SHA-256 fingerprint from SSH public key
// Note: This function is duplicated in src/cli/ssh-key.ts to keep CLI and server independent
function calculateFingerprint(publicKeyStr: string): string | null {
  try {
    const parsed = utils.parseKey(publicKeyStr);
    if (!parsed || parsed instanceof Error) {
      return null;
    }
    const pubKey = parsed.getPublicSSH();
    const hash = crypto.createHash('sha256').update(pubKey).digest('base64');
    return `SHA256:${hash}`;
  } catch (err) {
    console.error('Error calculating fingerprint:', err);
    return null;
  }
}

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

// Get SSH key fingerprints for a user
router.get('/:username/ssh-key-fingerprints', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { username, admin } = req.user as { username: string; admin: boolean };
  const targetUsername = req.params.username.toLowerCase();

  // Only allow users to view their own keys, or admins to view any keys
  if (username !== targetUsername && !admin) {
    res.status(403).json({ error: 'Not authorized to view keys for this user' });
    return;
  }

  try {
    const publicKeys = await db.getPublicKeys(targetUsername);
    const keyFingerprints = publicKeys.map((keyRecord) => ({
      fingerprint: keyRecord.fingerprint,
      name: keyRecord.name,
      addedAt: keyRecord.addedAt,
    }));
    res.json(keyFingerprints);
  } catch (error) {
    console.error('Error retrieving SSH keys:', error);
    res.status(500).json({ error: 'Failed to retrieve SSH keys' });
  }
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

  const { publicKey, name } = req.body;
  if (!publicKey) {
    res.status(400).json({ error: 'Public key is required' });
    return;
  }

  // Strip the comment from the key (everything after the last space)
  const keyWithoutComment = publicKey.trim().split(' ').slice(0, 2).join(' ');

  // Calculate fingerprint
  const fingerprint = calculateFingerprint(keyWithoutComment);
  if (!fingerprint) {
    res.status(400).json({ error: 'Invalid SSH public key format' });
    return;
  }

  const publicKeyRecord = {
    key: keyWithoutComment,
    name: name || 'Unnamed Key',
    addedAt: new Date().toISOString(),
    fingerprint: fingerprint,
  };

  console.log('Adding SSH key', { targetUsername, fingerprint });
  try {
    await db.addPublicKey(targetUsername, publicKeyRecord);
    res.status(201).json({
      message: 'SSH key added successfully',
      fingerprint: fingerprint,
    });
  } catch (error: any) {
    console.error('Error adding SSH key:', error);

    // Return specific error message
    if (error.message === 'SSH key already exists') {
      res.status(409).json({ error: 'This SSH key already exists' });
    } else if (error.message === 'User not found') {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to add SSH key' });
    }
  }
});

// Remove SSH public key by fingerprint
router.delete('/:username/ssh-keys/:fingerprint', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { username, admin } = req.user as { username: string; admin: boolean };
  const targetUsername = req.params.username.toLowerCase();
  const fingerprint = req.params.fingerprint;

  // Only allow users to remove keys from their own account, or admins to remove from any account
  if (username !== targetUsername && !admin) {
    res.status(403).json({ error: 'Not authorized to remove keys for this user' });
    return;
  }

  console.log('Removing SSH key', { targetUsername, fingerprint });
  try {
    await db.removePublicKey(targetUsername, fingerprint);
    res.status(200).json({ message: 'SSH key removed successfully' });
  } catch (error: any) {
    console.error('Error removing SSH key:', error);

    // Return specific error message
    if (error.message === 'User not found') {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to remove SSH key' });
    }
  }
});

export default router;
