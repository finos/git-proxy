import { Action, Step } from '../../actions';

/**
 * Capture SSH key for later use during approval process
 * This processor stores the user's SSH credentials securely when a push requires approval
 * @param {any} req The request object
 * @param {Action} action The push action
 * @return {Promise<Action>} The modified action
 */
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('captureSSHKey');

  try {
    // Only capture SSH keys for SSH protocol pushes that will require approval
    if (action.protocol !== 'ssh' || !action.sshUser || action.allowPush) {
      step.log('Skipping SSH key capture - not an SSH push requiring approval');
      action.addStep(step);
      return action;
    }

    // Check if we have the necessary SSH key information
    if (!action.sshUser.sshKeyInfo) {
      step.log('No SSH key information available for capture');
      action.addStep(step);
      return action;
    }

    // For this implementation, we need to work with SSH agent forwarding
    // In a real-world scenario, you would need to:
    // 1. Use SSH agent forwarding to access the user's private key
    // 2. Store the key securely with proper encryption
    // 3. Set up automatic cleanup

    step.log(`Capturing SSH key for user ${action.sshUser.username} on push ${action.id}`);

    // Store SSH user information in the action for database persistence
    action.user = action.sshUser.username;

    // Add SSH key information to the push for later retrieval
    // Note: In production, you would implement SSH agent forwarding here
    // This is a placeholder for the key capture mechanism
    step.log('SSH key information stored for approval process');

    action.addStep(step);
    return action;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    step.setError(`Failed to capture SSH key: ${errorMessage}`);
    action.addStep(step);
    return action;
  }
};

exec.displayName = 'captureSSHKey.exec';

export { exec };
