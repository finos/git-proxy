import { Action, Step } from '../../actions';
import { SSHKeyForwardingService } from '../../../service/SSHKeyForwardingService';
import { SSHKeyManager } from '../../../security/SSHKeyManager';

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

    const authContext = req?.authContext ?? {};
    const sshKeyContext = authContext?.sshKey;
    const privateKeySource =
      sshKeyContext?.privateKey ?? sshKeyContext?.keyData ?? action.sshUser.sshKeyInfo.keyData;

    if (!privateKeySource) {
      step.log('No SSH private key available for capture');
      action.addStep(step);
      return action;
    }

    const privateKeyBuffer = Buffer.isBuffer(privateKeySource)
      ? Buffer.from(privateKeySource)
      : Buffer.from(privateKeySource);
    const publicKeySource = action.sshUser.sshKeyInfo.keyData;
    const publicKeyBuffer = publicKeySource
      ? Buffer.isBuffer(publicKeySource)
        ? Buffer.from(publicKeySource)
        : Buffer.from(publicKeySource)
      : Buffer.alloc(0);

    // For this implementation, we need to work with SSH agent forwarding
    // In a real-world scenario, you would need to:
    // 1. Use SSH agent forwarding to access the user's private key
    // 2. Store the key securely with proper encryption
    // 3. Set up automatic cleanup

    step.log(`Capturing SSH key for user ${action.sshUser.username} on push ${action.id}`);

    const addedToAgent = SSHKeyForwardingService.addSSHKeyForPush(
      action.id,
      Buffer.from(privateKeyBuffer),
      publicKeyBuffer,
      action.sshUser.email ?? action.sshUser.username,
    );

    if (!addedToAgent) {
      console.warn(
        `[SSH Key Capture] Failed to cache SSH key in forwarding service for push ${action.id}`,
      );
    }

    const encrypted = SSHKeyManager.encryptSSHKey(privateKeyBuffer);
    action.encryptedSSHKey = encrypted.encryptedKey;
    action.sshKeyExpiry = encrypted.expiryTime;
    step.log('SSH key information stored for approval process');
    step.setContent(`SSH key retained until ${encrypted.expiryTime.toISOString()}`);

    privateKeyBuffer.fill(0);

    // Store SSH user information in the action for database persistence
    action.user = action.sshUser.username;

    // Add SSH key information to the push for later retrieval
    // Note: In production, you would implement SSH agent forwarding here
    // This is a placeholder for the key capture mechanism

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
