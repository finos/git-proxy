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
import { getRepoByUrl } from '../../../db';

// Execute if the repo is approved
const exec = async (_req: Request, action: Action): Promise<Action> => {
  const step = new Step('checkRepoInAuthorisedList');

  const found = (await getRepoByUrl(action.url)) !== null;
  if (found) {
    step.log(`repo ${action.url} is in the authorisedList`);
  } else {
    step.error = true;
    step.log(`repo ${action.url} is not in the authorised whitelist, ending`);
    step.setError(`Rejecting repo ${action.url} not in the authorised whitelist`);
  }

  action.addStep(step);
  return action;
};

exec.displayName = 'checkRepoInAuthorisedList.exec';

export { exec };
