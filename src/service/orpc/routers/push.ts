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

import type { ORPCErrorConstructorMap } from '@orpc/server';
import { z } from 'zod';

import * as db from '../../../db';
import { PushQuery } from '../../../db/types';
import { Action } from '../../../proxy/actions';
import { AttestationConfig } from '../../../config/generated/config';
import { getAttestationConfig } from '../../../config';
import { AttestationAnswer, Rejection } from '../../../proxy/processors/types';
import { pub } from '../base';
import { SessionUser } from '../context';
import { MessageBody, messageError, withBody } from '../errors';
import { docOnly, documentedUnknown, FilterQuery, PushSchema } from '../schemas';

const IdParams = z.object({ id: z.string() });

const pushErrors = {
  UNAUTHORIZED: messageError(401, 'Not logged in'),
  BAD_REQUEST: messageError(400),
  FORBIDDEN: messageError(403),
  NOT_FOUND: messageError(404),
  CONFLICT: messageError(409),
};

const notLoggedIn = { message: 'Not logged in' };

const list = pub
  .route({ method: 'GET', path: '/', summary: 'List pushes' })
  .input(z.object({ query: FilterQuery }))
  .output(docOnly<Action[]>(z.array(PushSchema)))
  .handler(async ({ context }) => {
    const query: Partial<PushQuery> = {
      type: 'push',
    };

    // Express's own query parser, so repeated and bracketed keys behave as before.
    const reqQuery = context.req.query;
    for (const key in reqQuery) {
      if (!key) continue;
      if (key === 'limit' || key === 'skip') continue;

      const rawValue = reqQuery[key];
      let parsedValue: boolean | undefined;
      if (rawValue === 'false') parsedValue = false;
      if (rawValue === 'true') parsedValue = true;
      query[key] = parsedValue ?? rawValue?.toString();
    }

    return db.getPushes(query);
  });

const get = pub
  .route({ method: 'GET', path: '/{id}', summary: 'Get a push' })
  .errors({ NOT_FOUND: messageError(404, 'not found') })
  .input(z.object({ params: IdParams }))
  .output(docOnly<Action>(PushSchema))
  .handler(async ({ input, errors }) => {
    const push = await db.getPush(input.params.id);
    if (push) {
      return push;
    }
    throw withBody(errors.NOT_FOUND, { message: 'not found' });
  });

const reject = pub
  .route({ method: 'POST', path: '/{id}/reject', summary: 'Reject a push' })
  .errors(pushErrors)
  .input(
    z.object({
      params: IdParams,
      body: z.looseObject({ reason: z.string().optional() }).optional(),
    }),
  )
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, notLoggedIn);
    }

    const id = input.params.id;
    const { username } = context.req.user as SessionUser;
    const reason = input.body?.reason;

    if (!reason || !reason.trim()) {
      throw withBody(errors.BAD_REQUEST, { message: 'Rejection reason is required' });
    }

    // Get the push request
    const push = await getValidPushOrThrow(id, errors);

    if (await isOwnPush(push, username)) {
      throw withBody(errors.FORBIDDEN, { message: `Cannot reject your own changes` });
    }

    const isAllowed = await db.canUserApproveRejectPush(id, username);

    if (isAllowed) {
      const reviewerList = await db.getUsers({ username });
      const reviewerEmail = reviewerList[0].email;

      if (!reviewerEmail) {
        throw withBody(errors.NOT_FOUND, {
          message: `There was no registered email address for the reviewer: ${username}`,
        });
      }

      const rejection: Rejection = {
        reason,
        timestamp: new Date(),
        reviewer: {
          username,
          email: reviewerEmail,
        },
      };

      const result = await db.reject(id, rejection);
      console.log(
        `User ${username} rejected push request for ${id}${reason ? ` with reason: ${reason}` : ''}`,
      );
      return result;
    }

    throw withBody(errors.FORBIDDEN, {
      message: `User ${username} is not authorised to reject changes on this project`,
    });
  });

const AttestationAnswers = documentedUnknown({
  type: 'array',
  items: {
    type: 'object',
    properties: { label: { type: 'string' }, checked: { type: 'boolean' } },
    required: ['label', 'checked'],
  },
});

const authorise = pub
  .route({ method: 'POST', path: '/{id}/authorise', summary: 'Approve a push' })
  .errors(pushErrors)
  .input(
    z.object({
      params: IdParams,
      body: z
        .looseObject({ params: z.looseObject({ attestation: AttestationAnswers }).optional() })
        .optional(),
    }),
  )
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, notLoggedIn);
    }

    const answers = input.body?.params?.attestation as AttestationAnswer[];

    const attestationComplete = validateAttestation(answers, getAttestationConfig());

    if (!attestationComplete) {
      throw withBody(errors.BAD_REQUEST, { message: 'Attestation is not complete' });
    }

    const id = input.params.id;

    const { username } = context.req.user as SessionUser;

    const push = await getValidPushOrThrow(id, errors);

    // A record written before pusher identity was verified carries whatever the
    // pushed objects said. The four-eyes check cannot be applied to it, so it
    // cannot be approved; a fresh push creates a verified record in its place.
    if (!push.pusherVerified) {
      throw withBody(errors.CONFLICT, {
        message:
          'This push was recorded without a verified pusher identity and cannot be approved. ' +
          'Ask the pusher to push again.',
      });
    }

    if (await isOwnPush(push, username)) {
      throw withBody(errors.FORBIDDEN, { message: `Cannot approve your own changes` });
    }

    // If we are not the pusher, now check that we are allowed to authorise on this
    // repo
    const isAllowed = await db.canUserApproveRejectPush(id, username);
    if (isAllowed) {
      console.log(`User ${username} approved push request for ${id}`);

      const reviewerList = await db.getUsers({ username });
      const reviewerEmail = reviewerList[0].email;

      if (!reviewerEmail) {
        throw withBody(errors.NOT_FOUND, {
          message: `There was no registered email address for the reviewer: ${username}`,
        });
      }

      const attestation = {
        answers,
        timestamp: new Date(),
        reviewer: {
          username,
          email: reviewerEmail,
        },
      };
      return db.authorise(id, attestation);
    }

    throw withBody(errors.FORBIDDEN, {
      message: `User ${username} not authorised to approve pushes on this project`,
    });
  });

const cancel = pub
  .route({ method: 'POST', path: '/{id}/cancel', summary: 'Cancel a push' })
  .errors({ UNAUTHORIZED: pushErrors.UNAUTHORIZED, FORBIDDEN: pushErrors.FORBIDDEN })
  .input(z.object({ params: IdParams }))
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, notLoggedIn);
    }

    const id = input.params.id;
    const { username } = context.req.user as SessionUser;

    const isAllowed = await db.canUserCancelPush(id, username);

    if (isAllowed) {
      const result = await db.cancel(id);
      console.log(`User ${username} canceled push request for ${id}`);
      return result;
    }

    console.log(`User ${username} not authorised to cancel push request for ${id}`);
    throw withBody(errors.FORBIDDEN, {
      message: `User ${username} not authorised to cancel push requests on this project`,
    });
  });

async function getValidPushOrThrow(
  id: string,
  errors: Pick<ORPCErrorConstructorMap<typeof pushErrors>, 'NOT_FOUND' | 'BAD_REQUEST'>,
): Promise<Action> {
  console.log('getValidPushOrRespond', { id });
  const push = await db.getPush(id);

  if (!push) {
    throw withBody(errors.NOT_FOUND, { message: `Push request not found` });
  }

  if (!push.user) {
    throw withBody(errors.BAD_REQUEST, { message: `Push request has no pusher recorded` });
  }

  return push;
}

/**
 * The pusher recorded on the action is the git-proxy user the push credential
 * resolved to, so the four-eyes check is a comparison of usernames. Admins are
 * exempt, as before.
 * @param {Action} push the held push
 * @param {string} reviewer username of the reviewer
 * @return {Promise<boolean>} true when the reviewer pushed it and is not an admin
 */
async function isOwnPush(push: Action, reviewer: string): Promise<boolean> {
  if (!push.user || push.user.toLowerCase() !== reviewer.toLowerCase()) return false;
  const user = await db.findUser(reviewer);
  return !user?.admin;
}

function validateAttestation(answers: AttestationAnswer[], config: AttestationConfig): boolean {
  const configQuestions = config.questions ?? [];

  if (answers.length !== configQuestions.length) {
    return false;
  }

  const configLabels = new Set(configQuestions.map((q) => q.label));

  return answers.every((answer) => configLabels.has(answer.label) && !!answer.checked);
}

export const pushRouter = { list, get, reject, authorise, cancel };
