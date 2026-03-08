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

import { authorise, reject } from '../../db';
import { handleAndLogError } from '../../utils/errors';
import { CompletedAttestation, Rejection } from '../processors/types';
import { Action } from './Action';

const attemptAutoApproval = async (action: Action) => {
  try {
    const attestation: CompletedAttestation = {
      timestamp: new Date(),
      automated: true,
      answers: [],
      reviewer: {
        username: 'system',
        email: 'system@git-proxy.com',
      },
    };
    await authorise(action.id, attestation);
    console.log('Push automatically approved by system.');

    return true;
  } catch (error: unknown) {
    handleAndLogError(error, 'Error during auto-approval');
    return false;
  }
};

const attemptAutoRejection = async (action: Action) => {
  try {
    const rejection: Rejection = {
      timestamp: new Date(),
      automated: true,
      reviewer: {
        username: 'system',
        email: 'system@git-proxy.com',
      },
      reason: 'Auto-rejected by system',
    };
    await reject(action.id, rejection);
    console.log('Push automatically rejected by system.');

    return true;
  } catch (error: unknown) {
    handleAndLogError(error, 'Error during auto-rejection');
    return false;
  }
};

export { attemptAutoApproval, attemptAutoRejection };
