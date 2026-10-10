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

import { PullActionPlugin, PullPhase, type PullPluginOptions } from '@finos/git-proxy/plugin';
import type { Action } from '@finos/git-proxy/proxy/actions';
import type { Request } from 'express';

import { exec as parsePull } from './parsePull.ts';
import { exec as fetchWanted, rememberRecentFetch } from './fetchWanted.ts';
import { exec as resolveWants } from './resolveWants.ts';

const steps = [parsePull, fetchWanted, resolveWants];

const pluginOptions: PullPluginOptions = {
  phase: PullPhase.AFTER_AUTHORISATION,
  displayName: 'PullInspection',
};

async function exec(req: Request, action: Action): Promise<Action> {
  for (const step of steps) {
    action = await step(req, action);
    if (!action.continue()) break;
  }
  return action;
}

class PullInspectionPlugin extends PullActionPlugin {
  constructor() {
    super(exec, pluginOptions);
  }

  // Only remember wants after chain completed, so rejected pulls can be scanned again
  onChainSuccess(_req: Request, action: Action): void {
    rememberRecentFetch(action);
  }
}

export default new PullInspectionPlugin();
