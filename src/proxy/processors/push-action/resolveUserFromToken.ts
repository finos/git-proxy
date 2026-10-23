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

import { Request } from 'express';

import { Action, Step } from '../../actions';
import { getProviderForHost, PushCredential, scmTokenCache } from './tokenIdentity';
import { findUserByScmIdentity } from '../../../db';
import { getErrorMessage } from '../../../utils/errors';

/**
 * Establishes who is pushing from the credential that accompanied the push.
 *
 * The identity is never taken from the pushed objects: author, committer and
 * tagger lines are whatever the client chose to write. The only things bound to
 * a real person are the session (dashboard or SSH key) or the token presented
 * over HTTP Basic auth, which the upstream SCM can be asked about.
 *
 * A push whose identity cannot be established is blocked.
 */
async function exec(req: Request, action: Action): Promise<Action> {
  const step = new Step('resolveUserFromToken');

  if (req.user) {
    step.log(`User already resolved via session auth: ${action.user}`);
    action.addStep(step);
    return action;
  }

  try {
    const credential = extractBasicCredential(req, step);
    if (!credential) {
      action.addStep(step);
      return action;
    }

    let hostname: string;
    try {
      hostname = new URL(action.url).hostname;
    } catch {
      step.setError(`Push blocked: cannot parse hostname from repository URL '${action.url}'`);
      action.addStep(step);
      return action;
    }

    const provider = getProviderForHost(hostname);
    if (!provider) {
      step.setError(
        `Push blocked: no SCM provider is configured for host '${hostname}', so the pusher ` +
          `cannot be identified. Add the host to 'scmProviders' in the proxy configuration.`,
      );
      action.addStep(step);
      return action;
    }

    let identity = scmTokenCache.lookup(provider.name, credential);
    if (identity) {
      step.log(`${provider.name}: credential belongs to '${identity.username}' (cached)`);
    } else {
      identity = await provider.fetchScmIdentity(credential);
      if (!identity) {
        step.setError(
          `Push blocked: ${provider.name} did not accept the credential presented with this push ` +
            `(invalid token, or missing the scope to read the token owner).`,
        );
        action.addStep(step);
        return action;
      }
      step.log(`${provider.name}: credential belongs to '${identity.username}'`);
      scmTokenCache.store(provider.name, credential, identity);
    }

    const user = await findUserByScmIdentity(identity.provider, identity.username);
    if (!user) {
      step.setError(
        `Push blocked: ${provider.name} account '${identity.username}' is not linked to a ` +
          `git-proxy user. Link it from your profile or ask an administrator.`,
      );
      action.addStep(step);
      return action;
    }

    step.log(`Mapped ${provider.name}:${identity.username} to git-proxy user '${user.username}'`);
    action.user = user.username;
    action.userEmail = user.email;
    action.pusherVerified = true;
  } catch (error: unknown) {
    step.setError(`Push blocked: failed to resolve push identity: ${getErrorMessage(error)}`);
  }

  action.addStep(step);
  return action;
}

/**
 * Split an HTTP Basic credential. git sends the token in the password half.
 * The username half is free text and identifies nobody; the provider resolves
 * the token to an account.
 * @param {Request} req incoming request
 * @param {Step} step step to record the outcome on
 * @return {PushCredential | null} the credential, or null with the step marked as an error
 */
function extractBasicCredential(req: Request, step: Step): PushCredential | null {
  const authHeader = req.headers?.authorization;
  if (!authHeader) {
    step.setError(
      'Push blocked: no credentials were presented, so the pusher cannot be identified.',
    );
    return null;
  }

  const [scheme, encoded] = authHeader.split(' ');
  if (!scheme || !encoded || scheme.toLowerCase() !== 'basic') {
    step.setError('Push blocked: only HTTP Basic credentials can be used to identify the pusher.');
    return null;
  }

  const credentials = Buffer.from(encoded, 'base64').toString();
  const separatorIndex = credentials.indexOf(':');
  if (separatorIndex === -1) {
    step.setError('Push blocked: malformed HTTP Basic credentials.');
    return null;
  }

  const token = credentials.slice(separatorIndex + 1);
  if (!token) {
    step.setError('Push blocked: the credential presented with this push has no token.');
    return null;
  }
  return { username: credentials.slice(0, separatorIndex), token };
}

exec.displayName = 'resolveUserFromToken.exec';

export { exec };
