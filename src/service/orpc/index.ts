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

import type { RequestHandler } from 'express';
import { OpenAPIHandler } from '@orpc/openapi/node';

import type { Proxy } from '../../proxy';
import type { ServiceContext } from './context';
import { customErrorResponseBodyEncoder, legacyResponseInterceptor } from './errors';
import { createReferencePlugin } from './openapi';
import { apiRouter } from './routers';

export { apiRouter } from './routers';
export { DOCS_PATH, SPEC_PATH } from './openapi';

const handler = new OpenAPIHandler<ServiceContext>(apiRouter, {
  customErrorResponseBodyEncoder,
  interceptors: [legacyResponseInterceptor],
  plugins: [createReferencePlugin()],
});

/**
 * Express middleware serving the whole service API through oRPC.
 *
 * Requests that match no procedure fall through to the next Express handler
 * (the static UI). Errors that are not `ORPCError`s are passed to `next(err)`,
 * so Express's error handler answers them exactly as it did before.
 * @param {Proxy} proxy the running proxy, restarted when repositories change
 * @return {RequestHandler} the middleware
 */
export const createApiMiddleware =
  (proxy: Proxy): RequestHandler =>
  async (req, res, next) => {
    const context: ServiceContext = { req, res, proxy };
    try {
      const { matched } = await handler.handle(req, res, { context });
      if (!matched) {
        next(context.forwardedError);
      }
    } catch (error: unknown) {
      next(error);
    }
  };
