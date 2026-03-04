import { Action } from '../../actions';
import { PullRemoteHTTPS } from './PullRemoteHTTPS';
import { PullRemoteSSH } from './PullRemoteSSH';
import { PullRemoteBase } from './PullRemoteBase';

/**
 * Factory function to select appropriate pull remote implementation
 *
 * Strategy:
 * - SSH protocol requires agent forwarding (no fallback)
 * - HTTPS protocol uses Basic Auth credentials
 */
function createPullRemote(req: any, action: Action): PullRemoteBase {
  if (action.protocol === 'ssh') {
    if (!req?.sshClient?.agentForwardingEnabled || !req?.sshClient) {
      throw new Error(
        'SSH clone requires agent forwarding to be enabled. ' +
          'Please ensure your SSH client is configured with agent forwarding (ssh -A).',
      );
    }
    return new PullRemoteSSH();
  }

  return new PullRemoteHTTPS();
}

/**
 * Execute pull remote operation
 * Delegates to appropriate implementation based on protocol and capabilities
 */
const exec = async (req: any, action: Action): Promise<Action> => {
  const pullRemote = createPullRemote(req, action);
  return await pullRemote.exec(req, action);
};

exec.displayName = 'pullRemote.exec';
export { exec };
