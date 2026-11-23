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

/**
 * This sample demonstrates how GitProxy holds the push until an
 * external service has completed. You can replace the mock DLP
 * service with any other asynchronous service.
 */

import type { Request } from 'express';

import { PushActionPlugin, PushPhase, type PushPluginOptions } from '@finos/git-proxy/plugin';
import { Step, type Action } from '@finos/git-proxy/proxy/actions';
import { acknowledgeScan, submitScan, type DlpScan, type Verdict } from './mockDlpService.ts';

const TIMEOUT_MS = 5 * 60 * 1000;
const DISCONNECT_POLL_MS = 1000;

type ServiceResult =
  { status: 'completed'; verdict: Verdict } | { status: 'timeout' } | { status: 'disconnected' };

type ProxiedRequest = Request & { isSSH?: boolean; sshClient?: { disconnected?: boolean } };

const pluginOptions: PushPluginOptions = {
  phase: PushPhase.AFTER_DIFF,
  displayName: 'ExternalServiceIntegration',
  isCollectible: true,
  chains: ['branch'],
};

class ExternalServiceIntegration extends PushActionPlugin {
  constructor() {
    super(exec, pluginOptions);
  }
}

async function exec(req: Request, action: Action) {
  const step = new Step('ExternalServiceIntegration');
  const diff = action.diff ?? action.steps.find((s) => s.stepName === 'diff')?.content;

  if (typeof diff !== 'string' || !diff) {
    step.log('No diff found. Submitting empty diff to DLP service.');
  }

  const diffBytes = typeof diff === 'string' ? Buffer.byteLength(diff) : 0;
  const { scan, reattached } = submitScan(action.id, diffBytes);

  step.log(
    reattached
      ? `Reattached to existing DLP scan ${scan.id}`
      : `Submitted DLP scan ${scan.id}, ${diffBytes} bytes`,
  );

  const startedWaitingAt = Date.now();
  const result = await waitForResult(req as ProxiedRequest, scan, TIMEOUT_MS);

  switch (result.status) {
    case 'completed': {
      acknowledgeScan(action.id, scan);
      const elapsedMs = Date.now() - startedWaitingAt;
      if (result.verdict.approved) {
        trace(`Push accepted after ${elapsedMs}ms`);
        step.log(`DLP scan approved push ${action.id} after ${elapsedMs}ms`);
      } else {
        trace(`Push rejected after ${elapsedMs}ms: ${result.verdict.reason}`);
        step.setError(
          `DLP scan blocked push ${action.id} after ${elapsedMs}ms: ${result.verdict.reason}`,
        );
      }
      break;
    }
    case 'timeout':
      trace(`DLP scan ${scan.id} for push ${action.id} still running after ${TIMEOUT_MS}ms`);
      step.setError(
        `DLP scan ${scan.id} for push ${action.id} still running after ${TIMEOUT_MS}ms. Run "git push" again to check the result.`,
      );
      break;
    case 'disconnected':
      trace(`Client disconnected while waiting on scan ${scan.id} for push ${action.id}`);
      step.setError(
        'Client disconnected before the DLP scan completed. Run "git push" again to check the result.',
      );
      break;
  }

  action.addStep(step);
  return action;
}

/****************************************
 * External service integration helpers *
 ****************************************/

async function waitForResult(
  req: ProxiedRequest,
  scan: DlpScan,
  timeoutMs: number,
): Promise<ServiceResult> {
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let disconnectPoll: ReturnType<typeof setInterval> | undefined;

  try {
    return await Promise.race<ServiceResult>([
      scan.result.then((verdict) => {
        return { status: 'completed', verdict };
      }),
      new Promise((resolve) => {
        timeoutTimer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
      }),
      new Promise((resolve) => {
        disconnectPoll = setInterval(() => {
          if (isClientDisconnected(req)) {
            resolve({ status: 'disconnected' });
          }
        }, DISCONNECT_POLL_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeoutTimer);
    clearInterval(disconnectPoll);
  }
}

/**
 * Whether the client that sent this push has gone away
 * (HTTP socket closed, or SSH session ended).
 */
function isClientDisconnected(req: ProxiedRequest): boolean {
  if (req.isSSH) {
    return req.sshClient?.disconnected === true;
  }
  return req.socket?.destroyed === true;
}

const trace = (message: string) =>
  console.log(`[ExternalServiceIntegration] ${new Date().toISOString()} ${message}`);

export default new ExternalServiceIntegration();
