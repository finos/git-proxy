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

import type { Request, Response } from 'express';
import type { PassportStatic } from 'passport';

/**
 * Passport is connect middleware: it reads and mutates `req` (user, session)
 * and, on failure or redirect, writes the response itself. These helpers run
 * it on the raw Express request/response from a procedure. When passport has
 * already ended the response, oRPC does not write another one.
 */

type ConnectMiddleware = (req: Request, res: Response, next: (err?: unknown) => void) => void;

/** `next`: passport handed control on. `responded`: passport ended the response itself. */
export type MiddlewareOutcome = 'next' | 'responded';

export type AuthenticateResult = { err: unknown; user: unknown; info: unknown };

/**
 * Settles a promise exactly once, either through `settle` or when the
 * response finishes or closes.
 * @param {Response} res the response to watch
 * @param {Function} onResponded called if the response ends first
 * @return {Function} the settle function
 */
const settleOnce = (res: Response, onResponded: () => void) => {
  let settled = false;

  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    res.off('finish', onEnd);
    res.off('close', onEnd);
    fn();
  };
  const onEnd = () => settle(onResponded);

  res.once('finish', onEnd);
  res.once('close', onEnd);
  return settle;
};

/**
 * Runs connect-style middleware such as `passport.authenticate(strategy)`.
 * @param {ConnectMiddleware} middleware the middleware to run
 * @param {Request} req the Express request
 * @param {Response} res the Express response
 * @return {Promise<MiddlewareOutcome>} the outcome; rejects with what is passed to `next(err)`
 */
export const runMiddleware = (
  middleware: ConnectMiddleware,
  req: Request,
  res: Response,
): Promise<MiddlewareOutcome> =>
  new Promise((resolve, reject) => {
    const settle = settleOnce(res, () => resolve('responded'));
    try {
      middleware(req, res, (err?: unknown) => settle(() => (err ? reject(err) : resolve('next'))));
    } catch (err: unknown) {
      settle(() => reject(err));
    }
  });

/**
 * Runs `passport.authenticate` in custom-callback mode.
 * @param {PassportStatic} passport the configured passport instance
 * @param {string} strategy the strategy name
 * @param {Request} req the Express request
 * @param {Response} res the Express response
 * @return {Promise} the callback arguments, or the middleware outcome when the
 *   callback is not reached (redirect, or the strategy passed)
 */
export const authenticateWithCallback = (
  passport: PassportStatic,
  strategy: string,
  req: Request,
  res: Response,
): Promise<AuthenticateResult | MiddlewareOutcome> =>
  new Promise((resolve, reject) => {
    const settle = settleOnce(res, () => resolve('responded'));
    const middleware: ConnectMiddleware = passport.authenticate(
      strategy,
      (err: unknown, user: unknown, info: unknown) => settle(() => resolve({ err, user, info })),
    );
    try {
      middleware(req, res, (err?: unknown) => settle(() => (err ? reject(err) : resolve('next'))));
    } catch (err: unknown) {
      settle(() => reject(err));
    }
  });

/**
 * Promisified `req.logIn`, which establishes the login session.
 * @param {Request} req the Express request
 * @param {Express.User} user the user to log in
 * @return {Promise<void>} resolves once the session is established
 */
export const logIn = (req: Request, user: Express.User): Promise<void> =>
  new Promise((resolve, reject) => {
    req.logIn(user, (err: unknown) => (err ? reject(err) : resolve()));
  });
