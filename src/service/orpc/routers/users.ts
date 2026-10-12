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

import crypto from 'crypto';
import { z } from 'zod';

import * as db from '../../../db';
import { PublicUser } from '../../../db/types';
import { Action } from '../../../proxy/actions';
import { pub } from '../base';
import { toPublicUser } from '../context';
import { errorKeyError, MessageBody, messageError, withBody } from '../errors';
import {
  docOnly,
  documentedUnknown,
  PublicUserSchema,
  PushSchema,
  SshKeyFingerprintSchema,
} from '../schemas';

// Calculate SHA-256 fingerprint from SSH public key
// Note: This function is duplicated in src/cli/ssh-key.ts to keep CLI and server independent
function calculateFingerprint(publicKeyStr: string): string | null {
  try {
    const { utils } = require('ssh2');
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

const IdParams = z.object({ id: z.string() });
const UsernameParams = z.object({ username: z.string() });

const authenticationRequired = { error: 'Authentication required' };

const sshKeyErrors = {
  UNAUTHORIZED: errorKeyError(401, 'Authentication required'),
  FORBIDDEN: errorKeyError(403),
  NOT_FOUND: errorKeyError(404, 'User not found'),
  INTERNAL_SERVER_ERROR: errorKeyError(500),
};

const list = pub
  .route({ method: 'GET', path: '/', summary: 'List users' })
  .output(docOnly<PublicUser[]>(z.array(PublicUserSchema)))
  .handler(async () => {
    console.log('fetching users');
    const [users, activityCounts] = await Promise.all([
      db.getUsers(),
      db.getUserActivityTabCountsByUsername(),
    ]);
    return users.map((u) => {
      const publicUser = toPublicUser(u);
      const activity = activityCounts.get(u.username.toLowerCase());
      return activity ? { ...publicUser, activity } : publicUser;
    });
  });

const activity = pub
  .route({ method: 'GET', path: '/{id}/activity', summary: "List a user's pushes" })
  .errors({ NOT_FOUND: messageError(404) })
  .input(z.object({ params: IdParams }))
  .output(docOnly<Action[]>(z.array(PushSchema)))
  .handler(async ({ input, errors }) => {
    const username = input.params.id.toLowerCase();
    const user = await db.findUser(username);
    if (!user) {
      throw withBody(errors.NOT_FOUND, { message: `User ${username} not found` });
    }
    return db.getPushesForUserProfile(user);
  });

const get = pub
  .route({ method: 'GET', path: '/{id}', summary: 'Get a user' })
  .errors({ NOT_FOUND: messageError(404) })
  .input(z.object({ params: IdParams }))
  .output(docOnly<PublicUser>(PublicUserSchema))
  .handler(async ({ input, errors }) => {
    const username = input.params.id.toLowerCase();
    console.log(`Retrieving details for user: ${username}`);
    const user = await db.findUser(username);
    if (!user) {
      throw withBody(errors.NOT_FOUND, { message: `User ${username} not found` });
    }
    return toPublicUser(user);
  });

// Get SSH key fingerprints for a user
const sshKeyFingerprints = pub
  .route({
    method: 'GET',
    path: '/{username}/ssh-key-fingerprints',
    summary: "List a user's SSH key fingerprints",
  })
  .errors({
    UNAUTHORIZED: sshKeyErrors.UNAUTHORIZED,
    FORBIDDEN: sshKeyErrors.FORBIDDEN,
    INTERNAL_SERVER_ERROR: sshKeyErrors.INTERNAL_SERVER_ERROR,
  })
  .input(z.object({ params: UsernameParams }))
  .output(
    docOnly<{ fingerprint: string; name: string; addedAt: string }[]>(
      z.array(SshKeyFingerprintSchema),
    ),
  )
  .handler(async ({ context, input, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, authenticationRequired);
    }

    const { username, admin } = context.req.user as { username: string; admin: boolean };
    const targetUsername = input.params.username.toLowerCase();

    // Only allow users to view their own keys, or admins to view any keys
    if (username !== targetUsername && !admin) {
      throw withBody(errors.FORBIDDEN, { error: 'Not authorized to view keys for this user' });
    }

    let keyFingerprints;
    try {
      const publicKeys = await db.getPublicKeys(targetUsername);
      keyFingerprints = publicKeys.map((keyRecord) => ({
        fingerprint: keyRecord.fingerprint,
        name: keyRecord.name,
        addedAt: keyRecord.addedAt,
      }));
    } catch (error) {
      console.error('Error retrieving SSH keys:', error);
      throw withBody(errors.INTERNAL_SERVER_ERROR, { error: 'Failed to retrieve SSH keys' });
    }
    return keyFingerprints;
  });

// Add SSH public key
const addSshKey = pub
  .route({
    method: 'POST',
    path: '/{username}/ssh-keys',
    successStatus: 201,
    summary: 'Add an SSH public key',
  })
  .errors({
    ...sshKeyErrors,
    BAD_REQUEST: errorKeyError(400),
    CONFLICT: errorKeyError(409, 'This SSH key already exists'),
  })
  .input(
    z.object({
      params: UsernameParams,
      body: z
        .looseObject({
          publicKey: documentedUnknown({ type: 'string' }),
          name: documentedUnknown({ type: 'string' }),
        })
        .optional(),
    }),
  )
  .output(
    docOnly<{ message: string; fingerprint: string }>(
      z.object({ message: z.string(), fingerprint: z.string() }),
    ),
  )
  .handler(async ({ context, input, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, authenticationRequired);
    }

    const { username, admin } = context.req.user as { username: string; admin: boolean };
    const targetUsername = input.params.username.toLowerCase();

    // Only allow users to add keys to their own account, or admins to add to any account
    if (username !== targetUsername && !admin) {
      throw withBody(errors.FORBIDDEN, { error: 'Not authorized to add keys for this user' });
    }

    const publicKey = input.body?.publicKey as string;
    const name = input.body?.name as string;
    if (!publicKey) {
      throw withBody(errors.BAD_REQUEST, { error: 'Public key is required' });
    }

    // Strip the comment from the key (everything after the last space)
    const keyWithoutComment = publicKey.trim().split(' ').slice(0, 2).join(' ');

    // Calculate fingerprint
    const fingerprint = calculateFingerprint(keyWithoutComment);
    if (!fingerprint) {
      throw withBody(errors.BAD_REQUEST, { error: 'Invalid SSH public key format' });
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
    } catch (error: any) {
      console.error('Error adding SSH key:', error);

      // Return specific error message
      if (error.message === 'SSH key already exists') {
        throw withBody(errors.CONFLICT, { error: 'This SSH key already exists' });
      } else if (error.message === 'User not found') {
        throw withBody(errors.NOT_FOUND, { error: 'User not found' });
      } else {
        throw withBody(errors.INTERNAL_SERVER_ERROR, {
          error: error.message || 'Failed to add SSH key',
        });
      }
    }

    return {
      message: 'SSH key added successfully',
      fingerprint: fingerprint,
    };
  });

// Remove SSH public key by fingerprint
const removeSshKey = pub
  .route({
    method: 'DELETE',
    path: '/{username}/ssh-keys/{fingerprint}',
    summary: 'Remove an SSH public key',
  })
  .errors(sshKeyErrors)
  .input(z.object({ params: z.object({ username: z.string(), fingerprint: z.string() }) }))
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, authenticationRequired);
    }

    const { username, admin } = context.req.user as { username: string; admin: boolean };
    const targetUsername = input.params.username.toLowerCase();
    const fingerprint = input.params.fingerprint;

    // Only allow users to remove keys from their own account, or admins to remove from any account
    if (username !== targetUsername && !admin) {
      throw withBody(errors.FORBIDDEN, { error: 'Not authorized to remove keys for this user' });
    }

    console.log('Removing SSH key', { targetUsername, fingerprint });
    try {
      await db.removePublicKey(targetUsername, fingerprint);
    } catch (error: any) {
      console.error('Error removing SSH key:', error);

      // Return specific error message
      if (error.message === 'User not found') {
        throw withBody(errors.NOT_FOUND, { error: 'User not found' });
      } else {
        throw withBody(errors.INTERNAL_SERVER_ERROR, {
          error: error.message || 'Failed to remove SSH key',
        });
      }
    }
    return { message: 'SSH key removed successfully' };
  });

export const usersRouter = {
  list,
  activity,
  get,
  sshKeyFingerprints,
  addSshKey,
  removeSshKey,
};
