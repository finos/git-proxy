import { Action, Step } from '../../actions';
import { SSHKeyForwardingService } from '../../../service/SSHKeyForwardingService';
import { SSHKeyManager } from '../../../security/SSHKeyManager';

function getPrivateKeyBuffer(req: any, action: Action): Buffer | null {
  const sshKeyContext = req?.authContext?.sshKey;
  const keyData =
    sshKeyContext?.privateKey ?? sshKeyContext?.keyData ?? action.sshUser?.sshKeyInfo?.keyData;

  return keyData ? toBuffer(keyData) : null;
}

function toBuffer(data: any): Buffer {
  if (!data) {
    return Buffer.alloc(0);
  }
  return Buffer.from(data);
}

/**
 * Capture SSH key for later use during approval process
 * This processor stores the user's SSH credentials securely when a push requires approval
 * @param {any} req The request object
 * @param {Action} action The push action
 * @return {Promise<Action>} The modified action
 */
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('captureSSHKey');
  let privateKeyBuffer: Buffer | null = null;
  let publicKeyBuffer: Buffer | null = null;

  try {
    // Only capture SSH keys for SSH protocol pushes that will require approval
    if (action.protocol !== 'ssh' || !action.sshUser || action.allowPush) {
      step.log('Skipping SSH key capture - not an SSH push requiring approval');
      action.addStep(step);
      return action;
    }

    privateKeyBuffer = getPrivateKeyBuffer(req, action);
    if (!privateKeyBuffer) {
      step.log('No SSH private key available for capture');
      action.addStep(step);
      return action;
    }
    const publicKeySource = action.sshUser?.sshKeyInfo?.keyData;
    publicKeyBuffer = toBuffer(publicKeySource);

    // For this implementation, we need to work with SSH agent forwarding
    // In a real-world scenario, you would need to:
    // 1. Use SSH agent forwarding to access the user's private key
    // 2. Store the key securely with proper encryption
    // 3. Set up automatic cleanup

    step.log(`Capturing SSH key for user ${action.sshUser.username} on push ${action.id}`);

    const addedToAgent = SSHKeyForwardingService.addSSHKeyForPush(
      action.id,
      privateKeyBuffer,
      publicKeyBuffer,
      action.sshUser.email ?? action.sshUser.username,
    );

    if (!addedToAgent) {
      throw new Error(
        `[SSH Key Capture] Failed to cache SSH key in forwarding service for push ${action.id}`,
      );
    }

    const encrypted = SSHKeyManager.encryptSSHKey(privateKeyBuffer);
    action.encryptedSSHKey = encrypted.encryptedKey;
    action.sshKeyExpiry = encrypted.expiryTime;
    action.user = action.sshUser.username; // Store SSH user info in action for db persistence

    step.log('SSH key information stored for approval process');
    step.setContent(`SSH key retained until ${encrypted.expiryTime.toISOString()}`);

    // Add SSH key information to the push for later retrieval
    // Note: In production, you would implement SSH agent forwarding here
    // This is a placeholder for the key capture mechanism
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    step.setError(`Failed to capture SSH key: ${errorMessage}`);
  } finally {
    privateKeyBuffer?.fill(0);
    publicKeyBuffer?.fill(0);
  }
  action.addStep(step);
  return action;
};

exec.displayName = 'captureSSHKey.exec';
export { exec };
