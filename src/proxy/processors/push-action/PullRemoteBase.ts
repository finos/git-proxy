import { Action, Step } from '../../actions';
import fs from 'fs';

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
    } catch (e: any) {
      const message = e instanceof Error ? e.message : (e?.toString?.('utf-8') ?? String(e));
      step.setError(message);

      // Clean up the checkout folder so it doesn't block subsequent attempts
      if (action.proxyGitPath && fs.existsSync(action.proxyGitPath)) {
        fs.rmSync(action.proxyGitPath, { recursive: true, force: true });
        step.log('.remote is deleted!');
      }

      throw e;
    } finally {
      action.addStep(step);
    }

    return action;
  }
}
