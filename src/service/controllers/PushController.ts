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

import { Body, Controller, Get, Path, Post, Request, Res, Route, Security, Tags } from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import * as db from '../../db';
import { PushQuery } from '../../db/types';
import { AttestationConfig } from '../../config/generated/config';
import { getAttestationConfig } from '../../config';
import { Action } from '../../proxy/actions/Action';
import { AttestationAnswer, Rejection } from '../../proxy/processors/types';
import { MessageResponse } from '../interfaces/common.interfaces';
import { RejectBody, AuthoriseBody } from '../interfaces/push.interfaces';
import {
  ForbiddenResponse,
  NotFoundResponse,
  UnauthorisedResponse,
  ValidationErrorResponse,
} from '../decorators/response.types';

/**
 * Push request management.
 */
@Route('api/v1/push')
@Security('jwt')
@Tags('Push')
export class PushController extends Controller {
  /**
   * Returns push requests, optionally filtered by query parameters.
   * Supported filters: any field from PushQuery (error, blocked, allowPush, authorised, canceled, rejected, type).
   */
  @Get('/')
  public async getPushes(@Request() req: ExpressRequest): Promise<Action[]> {
    const query: Partial<PushQuery> = { type: 'push' };

    for (const key in req.query) {
      if (!key) continue;
      if (key === 'limit' || key === 'skip') continue;

      const rawValue = req.query[key];
      let parsedValue: boolean | undefined;
      if (rawValue === 'false') parsedValue = false;
      if (rawValue === 'true') parsedValue = true;
      query[key] = parsedValue ?? rawValue?.toString();
    }

    return db.getPushes(query);
  }

  /**
   * Returns a single push request by ID.
   */
  @Get('/{id}')
  public async getPush(
    @Path() id: string,
    @Res() notFoundResponse: NotFoundResponse,
  ): Promise<Action> {
    const push = await db.getPush(id);
    if (!push) {
      return notFoundResponse(404, { message: 'not found' });
    }
    return push;
  }

  /**
   * Rejects a pending push request.
   */
  @Post('/{id}/reject')
  public async rejectPush(
    @Path() id: string,
    @Body() body: RejectBody,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
    @Res() validationErrorResponse: ValidationErrorResponse,
    @Res() notFoundResponse: NotFoundResponse,
    @Res() forbiddenResponse: ForbiddenResponse,
  ): Promise<MessageResponse> {
    if (!req.user) {
      return unauthorisedResponse(401, { message: 'Not logged in' });
    }

    const { reason } = body;
    if (!reason || !reason.trim()) {
      return validationErrorResponse(400, { message: 'Rejection reason is required' });
    }

    const { username } = req.user as { username: string };

    const push = await db.getPush(id);
    if (!push) {
      return notFoundResponse(404, { message: 'Push request not found' });
    }

    if (!push.userEmail) {
      return validationErrorResponse(400, { message: 'Push request has no user email' });
    }

    const committerEmail = push.userEmail;
    const list = await db.getUsers({ email: committerEmail });

    if (list.length === 0) {
      return notFoundResponse(404, {
        message: `No user found with the committer's email address: ${committerEmail}`,
      });
    }

    if (list[0].username.toLowerCase() === username.toLowerCase() && !list[0].admin) {
      return forbiddenResponse(403, { message: 'Cannot reject your own changes' });
    }

    const isAllowed = await db.canUserApproveRejectPush(id, username);
    if (!isAllowed) {
      return forbiddenResponse(403, {
        message: `User ${username} is not authorised to reject changes on this project`,
      });
    }

    const reviewerList = await db.getUsers({ username });
    const reviewerEmail = reviewerList[0].email;

    if (!reviewerEmail) {
      return notFoundResponse(404, {
        message: `There was no registered email address for the reviewer: ${username}`,
      });
    }

    const rejection: Rejection = {
      reason,
      timestamp: new Date(),
      reviewer: { username, email: reviewerEmail },
    };

    const result = await db.reject(id, rejection);
    console.log(
      `User ${username} rejected push request for ${id}${reason ? ` with reason: ${reason}` : ''}`,
    );
    return result;
  }

  /**
   * Authorises (approves) a pending push request.
   */
  @Post('/{id}/authorise')
  public async authorisePush(
    @Path() id: string,
    @Body() body: AuthoriseBody,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
    @Res() validationErrorResponse: ValidationErrorResponse,
    @Res() notFoundResponse: NotFoundResponse,
    @Res() forbiddenResponse: ForbiddenResponse,
  ): Promise<MessageResponse> {
    if (!req.user) {
      return unauthorisedResponse(401, { message: 'Not logged in' });
    }

    const answers = body.params.attestation;
    if (!validateAttestation(answers, getAttestationConfig())) {
      return validationErrorResponse(400, { message: 'Attestation is not complete' });
    }

    const { username } = req.user as { username: string };

    const push = await db.getPush(id);
    if (!push) {
      return notFoundResponse(404, { message: 'Push request not found' });
    }

    // Get the committer of the push via their email address
    const committerEmail = push.userEmail;
    const list = await db.getUsers({ email: committerEmail });

    if (list.length === 0) {
      return notFoundResponse(404, {
        message: `No user found with the committer's email address: ${committerEmail}`,
      });
    }

    if (list[0].username.toLowerCase() === username.toLowerCase() && !list[0].admin) {
      return forbiddenResponse(403, { message: 'Cannot approve your own changes' });
    }

    // If we are not the author, now check that we are allowed to authorise on this
    // repo
    const isAllowed = await db.canUserApproveRejectPush(id, username);
    if (!isAllowed) {
      return forbiddenResponse(403, {
        message: `User ${username} not authorised to approve pushes on this project`,
      });
    }

    const reviewerList = await db.getUsers({ username });
    const reviewerEmail = reviewerList[0].email;

    if (!reviewerEmail) {
      return notFoundResponse(404, {
        message: `There was no registered email address for the reviewer: ${username}`,
      });
    }

    const attestation = {
      answers,
      timestamp: new Date(),
      reviewer: { username, email: reviewerEmail },
    };

    console.log(`User ${username} approved push request for ${id}`);
    return db.authorise(id, attestation);
  }

  /**
   * Cancels a pending push request.
   */
  @Post('/{id}/cancel')
  public async cancelPush(
    @Path() id: string,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: UnauthorisedResponse,
    @Res() forbiddenResponse: ForbiddenResponse,
  ): Promise<MessageResponse> {
    if (!req.user) {
      return unauthorisedResponse(401, { message: 'Not logged in' });
    }

    const { username } = req.user as { username: string };
    const isAllowed = await db.canUserCancelPush(id, username);

    if (!isAllowed) {
      console.log(`User ${username} not authorised to cancel push request for ${id}`);
      return forbiddenResponse(403, {
        message: `User ${username} not authorised to cancel push requests on this project`,
      });
    }

    const result = await db.cancel(id);
    console.log(`User ${username} canceled push request for ${id}`);
    return result;
  }
}

function validateAttestation(answers: AttestationAnswer[], config: AttestationConfig): boolean {
  const configQuestions = config.questions ?? [];

  if (!answers || answers.length !== configQuestions.length) {
    return false;
  }

  const configLabels = new Set(configQuestions.map((q) => q.label));
  return answers.every((answer) => configLabels.has(answer.label) && !!answer.checked);
}
