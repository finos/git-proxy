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

import {
  Body,
  Controller,
  Delete,
  Get,
  Path,
  Post,
  Request,
  Res,
  Route,
  Security,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import crypto from 'crypto';
import * as db from '../../db';
import { PublicUser } from '../../db/types';
import { toPublicUser } from '../routes/utils';
import {
  AuthenticationRequiredResponse,
  BadRequestErrorResponse,
  ConflictErrorResponse,
  ForbiddenErrorResponse,
  NotFoundErrorResponse,
  NotFoundResponse,
  ServerErrorResponse,
} from '../decorators/response.types';
import {
  AddSSHKeyBody,
  AddSSHKeyResponse,
  RemoveSSHKeyResponse,
  SSHKeyFingerprint,
} from '../interfaces/user.interfaces';

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

/**
 * User listing.
 */
@Route('api/v1/user')
@Security('jwt')
@Tags('Users')
export class UserController extends Controller {
  /**
   * Returns all registered users (public fields only).
   */
  @Get('/')
  public async getUsers(): Promise<PublicUser[]> {
    console.log('fetching users');
    const users = await db.getUsers();
    return users.map(toPublicUser);
  }

  /**
   * Returns a single user by username.
   */
  @Get('/{id}')
  public async getUser(
    @Path() id: string,
    @Res() notFoundResponse: NotFoundResponse,
  ): Promise<PublicUser> {
    const username = id.toLowerCase();
    console.log(`Retrieving details for user: ${username}`);
    const user = await db.findUser(username);
    if (!user) {
      return notFoundResponse(404, { message: `User ${username} not found` });
    }
    return toPublicUser(user);
  }

  /**
   * Returns the SSH key fingerprints for a user.
   * Users may view their own keys; admins may view any user's keys.
   */
  @Get('/{username}/ssh-key-fingerprints')
  public async getSshKeyFingerprints(
    @Path() username: string,
    @Request() req: ExpressRequest,
    @Res() authRequiredResponse: AuthenticationRequiredResponse,
    @Res() forbiddenResponse: ForbiddenErrorResponse,
    @Res() serverErrorResponse: ServerErrorResponse,
  ): Promise<SSHKeyFingerprint[]> {
    if (!req.user) {
      return authRequiredResponse(401, { error: 'Authentication required' });
    }

    const { username: requesterUsername, admin } = req.user as {
      username: string;
      admin: boolean;
    };
    const targetUsername = username.toLowerCase();

    // Only allow users to view their own keys, or admins to view any keys
    if (requesterUsername !== targetUsername && !admin) {
      return forbiddenResponse(403, { error: 'Not authorized to view keys for this user' });
    }

    try {
      const publicKeys = await db.getPublicKeys(targetUsername);
      return publicKeys.map((keyRecord) => ({
        fingerprint: keyRecord.fingerprint,
        name: keyRecord.name,
        addedAt: keyRecord.addedAt,
      }));
    } catch (error) {
      console.error('Error retrieving SSH keys:', error);
      return serverErrorResponse(500, { error: 'Failed to retrieve SSH keys' });
    }
  }

  /**
   * Adds an SSH public key to a user's account.
   * Users may add keys to their own account; admins may add to any account.
   */
  @Post('/{username}/ssh-keys')
  public async addSshKey(
    @Path() username: string,
    @Body() body: AddSSHKeyBody,
    @Request() req: ExpressRequest,
    @Res() authRequiredResponse: AuthenticationRequiredResponse,
    @Res() forbiddenResponse: ForbiddenErrorResponse,
    @Res() badRequestResponse: BadRequestErrorResponse,
    @Res() notFoundResponse: NotFoundErrorResponse,
    @Res() conflictResponse: ConflictErrorResponse,
    @Res() serverErrorResponse: ServerErrorResponse,
  ): Promise<AddSSHKeyResponse> {
    if (!req.user) {
      return authRequiredResponse(401, { error: 'Authentication required' });
    }

    const { username: requesterUsername, admin } = req.user as {
      username: string;
      admin: boolean;
    };
    const targetUsername = username.toLowerCase();

    // Only allow users to add keys to their own account, or admins to add to any account
    if (requesterUsername !== targetUsername && !admin) {
      return forbiddenResponse(403, { error: 'Not authorized to add keys for this user' });
    }

    const { publicKey, name } = body;
    if (!publicKey) {
      return badRequestResponse(400, { error: 'Public key is required' });
    }

    // Strip the comment from the key (everything after the last space)
    const keyWithoutComment = publicKey.trim().split(' ').slice(0, 2).join(' ');

    // Calculate fingerprint
    const fingerprint = calculateFingerprint(keyWithoutComment);
    if (!fingerprint) {
      return badRequestResponse(400, { error: 'Invalid SSH public key format' });
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
      this.setStatus(201);
      return { message: 'SSH key added successfully', fingerprint };
    } catch (error: unknown) {
      console.error('Error adding SSH key:', error);

      // Return specific error message
      const message = error instanceof Error ? error.message : undefined;
      if (message === 'SSH key already exists') {
        return conflictResponse(409, { error: 'This SSH key already exists' });
      } else if (message === 'User not found') {
        return notFoundResponse(404, { error: 'User not found' });
      }
      return serverErrorResponse(500, { error: message || 'Failed to add SSH key' });
    }
  }

  /**
   * Removes an SSH public key from a user's account by fingerprint.
   * Users may remove keys from their own account; admins may remove from any account.
   */
  @Delete('/{username}/ssh-keys/{fingerprint}')
  public async removeSshKey(
    @Path() username: string,
    @Path() fingerprint: string,
    @Request() req: ExpressRequest,
    @Res() authRequiredResponse: AuthenticationRequiredResponse,
    @Res() forbiddenResponse: ForbiddenErrorResponse,
    @Res() notFoundResponse: NotFoundErrorResponse,
    @Res() serverErrorResponse: ServerErrorResponse,
  ): Promise<RemoveSSHKeyResponse> {
    if (!req.user) {
      return authRequiredResponse(401, { error: 'Authentication required' });
    }

    const { username: requesterUsername, admin } = req.user as {
      username: string;
      admin: boolean;
    };
    const targetUsername = username.toLowerCase();

    // Only allow users to remove keys from their own account, or admins to remove from any account
    if (requesterUsername !== targetUsername && !admin) {
      return forbiddenResponse(403, { error: 'Not authorized to remove keys for this user' });
    }

    console.log('Removing SSH key', { targetUsername, fingerprint });
    try {
      await db.removePublicKey(targetUsername, fingerprint);
      return { message: 'SSH key removed successfully' };
    } catch (error: unknown) {
      console.error('Error removing SSH key:', error);

      // Return specific error message
      const message = error instanceof Error ? error.message : undefined;
      if (message === 'User not found') {
        return notFoundResponse(404, { error: 'User not found' });
      }
      return serverErrorResponse(500, { error: message || 'Failed to remove SSH key' });
    }
  }
}
