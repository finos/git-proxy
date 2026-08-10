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
import { getErrorMessage } from '../../../utils/errors';

export type CloneResult = {
  command: string;
  strategy: Action['pullAuthStrategy'];
};

/**
 * Base class for pull remote implementations
 */
export abstract class PullRemoteBase {
  protected static readonly REMOTE_DIR = './.remote';

  /**
   * Ensure directory exists with proper permissions
   */
  protected async ensureDirectory(targetPath: string): Promise<void> {
    await fs.promises.mkdir(targetPath, { recursive: true, mode: 0o755 });
  }

  /**
   * Setup directories for clone operation
   */
  protected async setupDirectories(action: Action): Promise<void> {
    action.proxyGitPath = `${PullRemoteBase.REMOTE_DIR}/${action.id}`;

    if (fs.existsSync(action.proxyGitPath)) {
      throw new Error(
        'The checkout folder already exists - we may be processing a concurrent request for this push. If this issue persists the proxy may need to be restarted.',
      );
    }

    await this.ensureDirectory(PullRemoteBase.REMOTE_DIR);
    await this.ensureDirectory(action.proxyGitPath);
  }

  /**
   * @param req Request object
   * @param action Action object
   * @param step Step for logging
   * @returns CloneResult with command and strategy
   */
  protected abstract performClone(req: any, action: Action, step: Step): Promise<CloneResult>;

  /**
   * Main execution method
   * Defines the overall flow, delegates specifics to subclasses
   */
  async exec(req: any, action: Action): Promise<Action> {
    const step = new Step('pullRemote');

    try {
      await this.setupDirectories(action);

      const result = await this.performClone(req, action, step);

      action.pullAuthStrategy = result.strategy;
      step.log(`Completed ${result.command}`);
      step.setContent(`Completed ${result.command}`);
    } catch (error: unknown) {
      step.setError(getErrorMessage(error));

      // Clean up the checkout folder so it doesn't block subsequent attempts
      if (action.proxyGitPath && fs.existsSync(action.proxyGitPath)) {
        fs.rmSync(action.proxyGitPath, { recursive: true, force: true });
        step.log('.remote is deleted!');
      }

      throw error;
    } finally {
      action.addStep(step);
    }

    return action;
  }
}
