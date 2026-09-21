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
import { getProviderForHost, scmTokenCache } from './tokenIdentity';
import { findUserByGitAccount } from '../../../db';
import { getErrorMessage } from '../../../utils/errors';

async function exec(req: Request, action: Action): Promise<Action> {
  const step = new Step('resolveUserFromToken');

  if (req.user) {
    step.log(`User already resolved via session auth: ${action.user}`);
    action.addStep(step);
    return action;
  }

  try {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
      step.log('No Authorization header — cannot resolve push identity from token');
      action.addStep(step);
      return action;
    }

    const [scheme, encoded] = authHeader.split(' ');
    if (!scheme || !encoded || scheme.toLowerCase() !== 'basic') {
      step.log('Authorization header is not Basic — cannot resolve push identity');
      action.addStep(step);
      return action;
    }

    const credentials = Buffer.from(encoded, 'base64').toString();
    const separatorIndex = credentials.indexOf(':');
    if (separatorIndex === -1) {
      step.log('Malformed Basic auth credentials');
      action.addStep(step);
      return action;
    }

    const token = credentials.slice(separatorIndex + 1);

    let hostname: string;
    try {
      hostname = new URL(action.url).hostname;
    } catch {
      step.log(`Cannot parse hostname from action URL: ${action.url}`);
      action.addStep(step);
      return action;
    }

    const provider = getProviderForHost(hostname);
    if (!provider) {
      step.log(`No token identity provider for host '${hostname}' — identity resolution skipped`);
      action.addStep(step);
      return action;
    }

    const cached = scmTokenCache.lookup(provider.name, token);
    if (cached) {
      step.log(`${provider.name}: resolved push identity from cache: ${cached}`);
      action.user = cached;
      action.addStep(step);
      return action;
    }

    const identity = await provider.fetchScmIdentity(token);
    if (!identity) {
      step.log(
        `${provider.name}: failed to resolve identity from token (invalid token or missing scope?)`,
      );
      action.addStep(step);
      return action;
    }

    step.log(`${provider.name}: resolved SCM identity from token: ${identity.login}`);

    const user = await findUserByGitAccount(identity.login);
    if (user) {
      step.log(
        `Mapped SCM identity '${identity.login}' to git-proxy user '${user.username}' (${user.email})`,
      );
      action.user = user.username;
      action.userEmail = user.email;
      scmTokenCache.store(provider.name, token, user.username);
    } else {
      step.log(
        `No git-proxy user has gitAccount '${identity.login}' — ` +
          `falling back to SCM identity. ` +
          `Users can associate their account via POST /api/auth/gitAccount`,
      );
      action.user = identity.login;
    }
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    step.log(`Failed to resolve push identity from token: ${msg}`);
  }

  action.addStep(step);
  return action;
}

exec.displayName = 'resolveUserFromToken.exec';

export { exec };
