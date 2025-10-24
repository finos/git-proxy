const { normalisePublicKey, fingerprintSHA256 } = require('../utils/ssh-utils');

const express = require('express');
const router = new express.Router();
const db = require('../../db');
const { toPublicUser } = require('./publicApi');

router.get('/', async (req, res) => {
  console.log(`fetching users`);
  const users = await db.getUsers({});
  res.send(users.map(toPublicUser));
});

router.get('/:id', async (req, res) => {
  const username = req.params.id.toLowerCase();
  console.log(`Retrieving details for user: ${username}`);
  const user = await db.findUser(username);
  res.send(toPublicUser(user));
});

// Add SSH public key
router.post('/:username/ssh-keys', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const targetUsername = req.params.username.toLowerCase();

  // Only allow users to add keys to their own account, or admins to add to any account
  if (req.user.username !== targetUsername && !req.user.admin) {
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
router.delete('/:username/ssh-keys', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const targetUsername = req.params.username.toLowerCase();

  // Only allow users to remove keys from their own account, or admins to remove from any account
  if (req.user.username !== targetUsername && !req.user.admin) {
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

// Add SSH public key
router.post('/:username/ssh-keys', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const targetUsername = req.params.username.toLowerCase();

  // Only allow users to add keys to their own account, or admins to add to any account
  if (req.user.username !== targetUsername && !req.user.admin) {
    res.status(403).json({ error: 'Not authorized to add keys for this user' });
    return;
  }

  const { publicKey, name } = req.body;

  if (!name || typeof name !== 'string')
    return res.status(400).json({ error: 'Key name is required' });
  if (!publicKey) {
    res.status(400).json({ error: 'Public key is required' });
    return;
  }

  let canonicalKey;
  try {
    canonicalKey = normalisePublicKey(publicKey);
  } catch {
    return res.status(422).json({ error: 'Invalid SSH public key' });
  }

  try {
    const record = {
      key: canonicalKey,
      name: name.trim(),
      addedAt: new Date().toISOString(),
    };
    await db.addPublicKey(targetUsername, record);
    res.status(201).json({ message: 'SSH key added successfully' });
  } catch (error) {
    console.error('Error adding SSH key:', error);
    res.status(500).json({ error: 'Failed to add SSH key' });
  }
});

// Remove SSH public key
router.delete('/:username/ssh-keys', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const targetUsername = req.params.username.toLowerCase();

  // Only allow users to remove keys from their own account, or admins to remove from any account
  if (req.user.username !== targetUsername && !req.user.admin) {
    res.status(403).json({ error: 'Not authorized to remove keys for this user' });
    return;
  }

  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'Public key is required' });

  let canonicalKey;
  try {
    canonicalKey = normalisePublicKey(publicKey);
  } catch {
    return res.status(422).json({ error: 'Invalid SSH public key' });
  }

  try {
    await db.removePublicKey(targetUsername, canonicalKey);
    res.status(200).json({ message: 'SSH key removed successfully' });
  } catch (error) {
    console.error('Error removing SSH key:', error);
    res.status(500).json({ error: 'Failed to remove SSH key' });
  }
});

router.delete('/:username/ssh-keys/fingerprint', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const targetUsername = req.params.username.toLowerCase();

  if (req.user.username !== targetUsername && !req.user.admin) {
    return res.status(403).json({ error: 'Not authorized to remove keys for this user' });
  }

  const { fingerprint } = req.body;
  if (!fingerprint) {
    return res.status(400).json({ error: 'Fingerprint is required' });
  }

  try {
    const keys = await db.getPublicKeys(targetUsername);
    const keyToDelete = keys.find((rec) => {
      const keyFingerprint = fingerprintSHA256(rec.key);
      return keyFingerprint === fingerprint;
    });

    if (!keyToDelete) {
      return res.status(404).json({ error: 'SSH key not found for supplied fingerprint' });
    }

    await db.removePublicKey(targetUsername, keyToDelete.key);
    res.status(200).json({ message: 'SSH key removed successfully' });
  } catch (err) {
    console.error('Error removing SSH key:', err);
    res.status(500).json({ error: 'Failed to remove SSH key' });
  }
});

router.get('/:username/ssh-keys', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const targetUsername = req.params.username.toLowerCase();

  // A user can view their own keys; admins can view anyone's
  if (req.user.username !== targetUsername && !req.user.admin) {
    return res.status(403).json({ error: 'Not authorized to view keys for this user' });
  }

  try {
    const keys = await db.getPublicKeys(targetUsername);
    const result = keys.map((rec) => ({
      name: rec.name,
      fingerprint: fingerprintSHA256(rec.key),
      addedAt: rec.addedAt,
    }));

    res.status(200).json({ publicKeys: result });
  } catch (err) {
    console.error('Error fetching SSH keys:', err);
    res.status(500).json({ error: 'Failed to fetch SSH keys' });
  }
});

module.exports = router;
