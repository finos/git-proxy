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

import { Action, Step } from '../../actions';
import fs from 'fs';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('clearBareClone');

  // Recursively remove the contents of ./.remote and ignore exceptions
  if (action.proxyGitPath) {
    fs.rmSync(action.proxyGitPath, { recursive: true, force: true });
    step.log(`.remote is deleted!`);
  } else {
    // This action should not be called unless a clone was made successfully as pullRemote cleans up after itself on failures
    // Log an error as we couldn't delete the clone
    step.setError(`action.proxyGitPath was not set and cannot be removed`);
  }
  action.addStep(step);

  return action;
};

exec.displayName = 'clearBareClone.exec';

export { exec };
