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

import { ORPCError } from '@orpc/server';
import type { StandardHandlerOptions } from '@orpc/server/standard';
import type { JSONSchema } from '@orpc/openapi';
import { z } from 'zod';

import type { ServiceContext } from './context';

/**
 * The API predates oRPC and its clients (the UI and the CLI) depend on the
 * exact error bodies the Express routes sent: mostly `{ message }`, `{ error }`
 * for the SSH key and repo-user endpoints, and a bare string or an empty body
 * in a few auth paths. oRPC's own `{ defined, code, status, message, data }`
 * envelope is therefore replaced:
 *
 * - JSON bodies are declared errors whose `data` *is* the response body
 *   (see {@link customErrorResponseBodyEncoder}).
 * - Text and empty bodies are thrown as {@link RawResponse}.
 * - Anything else that is not an `ORPCError` is handed back to Express
 *   (see {@link legacyResponseInterceptor}).
 */

export const MessageBody = z.object({ message: z.string() });
export const ErrorBody = z.object({ error: z.string() });

/** Declares an error answered with `{ message }`, for a `.errors({...})` map. */
export const messageError = (status: number, message?: string) => ({
  status,
  message,
  data: MessageBody,
});

/** Declares an error answered with `{ error }`, for a `.errors({...})` map. */
export const errorKeyError = (status: number, message?: string) => ({
  status,
  message,
  data: ErrorBody,
});

/** Declares an error answered with a plain-text body. Documentation only: throw {@link RawResponse}. */
export const textError = (status: number, message?: string) => ({
  status,
  message,
  data: z.string(),
});

type LegacyBody = { message: string } | { error: string };

/**
 * Builds a declared error whose response body is exactly `body`.
 * @param {Function} construct a typed constructor from the procedure's `errors`
 * @param {LegacyBody} body the response body
 * @return {ORPCError} the error to throw
 */
export const withBody = <TBody extends LegacyBody>(
  construct: (options: { message?: string; data: TBody }) => ORPCError<string, unknown>,
  body: TBody,
): ORPCError<string, unknown> =>
  construct({ message: 'message' in body ? body.message : body.error, data: body });

/**
 * A response whose body is plain text (sent as `text/html`, like Express's
 * `res.send(string)`) or empty (like `res.status(n).end()`).
 *
 * Deliberately not an `ORPCError`, so it reaches {@link legacyResponseInterceptor}
 * untouched and bypasses the JSON error encoder.
 */
export class RawResponse extends Error {
  constructor(
    readonly status: number,
    readonly text?: string,
  ) {
    super(text ?? `HTTP ${status}`);
    this.name = 'RawResponse';
  }
}

/**
 * Hands the request on to the next Express handler, as a connect middleware
 * calling `next()` would (e.g. a passport strategy that passes).
 */
export class PassThrough extends Error {
  constructor() {
    super('Pass to the next Express handler');
    this.name = 'PassThrough';
  }
}

/**
 * Wraps text so oRPC sends it verbatim, with the content type Express's
 * `res.send(string)` used. A bare string would be JSON-encoded.
 * @param {string} text the response body
 * @return {Blob} the body to return from a handler
 */
export const textBody = (text: string): Blob =>
  new Blob([text], { type: 'text/html; charset=utf-8' });

/**
 * Error body encoder for the OpenAPI handler. Declared errors carry their
 * response body in `data`. Errors raised by oRPC itself (input validation,
 * mostly) keep the API's `{ message }` convention.
 * @param {ORPCError} error the error being sent
 * @return {unknown} the response body
 */
export const customErrorResponseBodyEncoder = (error: ORPCError<string, unknown>): unknown => {
  if (error.defined) {
    return error.data;
  }

  const issues = (error.data as { issues?: unknown } | undefined)?.issues;
  return issues ? { message: error.message, issues } : { message: error.message };
};

/**
 * Documents the bodies sent by {@link customErrorResponseBodyEncoder}: the
 * `data` schema of each error declared for the status.
 * @param {Array} definedErrors the errors declared for this status
 * @return {JSONSchema | null} the response body schema
 */
export const customErrorResponseBodySchema = (
  definedErrors: [code: string, message: string, required: boolean, schema: JSONSchema][],
): JSONSchema | null => {
  const schemas = definedErrors.map(([, , , schema]) => schema);
  if (schemas.length === 0) {
    return null;
  }
  return schemas.length === 1 ? schemas[0] : { anyOf: schemas };
};

type HandlerInterceptor = NonNullable<
  StandardHandlerOptions<ServiceContext>['interceptors']
>[number];

/**
 * Request-level interceptor that keeps Express parity for everything that is
 * not a declared JSON error:
 * - {@link RawResponse} is sent as plain text or an empty body;
 * - {@link PassThrough} reports the request as unmatched, so Express moves on;
 * - any other non-`ORPCError` is stashed on the context and the request is
 *   reported as unmatched, so the Express glue can call `next(err)` and the
 *   Express error handler answers exactly as it used to.
 */
export const legacyResponseInterceptor: HandlerInterceptor = async ({ next, context }) => {
  try {
    return await next();
  } catch (error: unknown) {
    if (error instanceof ORPCError) {
      throw error;
    }

    if (error instanceof RawResponse) {
      return {
        matched: true,
        response: {
          status: error.status,
          headers: {},
          body: error.text === undefined ? undefined : textBody(error.text),
        },
      };
    }

    if (!(error instanceof PassThrough)) {
      context.forwardedError = error;
    }
    return { matched: false, response: undefined };
  }
};
