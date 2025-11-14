# SSH Key Retention for GitProxy

## Overview

This document describes the SSH key retention feature that allows GitProxy to securely store and reuse user SSH keys during the approval process, eliminating the need for users to re-authenticate when their push is approved.

## Problem Statement

Previously, when a user pushes code via SSH to GitProxy:

1. User authenticates with their SSH key
2. Push is intercepted and requires approval
3. After approval, the system loses the user's SSH key
4. User must manually re-authenticate or the system falls back to proxy's SSH key

## Solution Architecture

### Components

1. **SSHKeyManager** (`src/security/SSHKeyManager.ts`)
   - Handles secure encryption/decryption of SSH keys
   - Manages key expiration (24 hours by default)
   - Provides cleanup mechanisms for expired keys

2. **SSHAgent** (`src/security/SSHAgent.ts`)
   - In-memory SSH key store with automatic expiration
   - Provides signing capabilities for SSH authentication
   - Singleton pattern for system-wide access

3. **SSH Key Capture Processor** (`src/proxy/processors/push-action/captureSSHKey.ts`)
   - Captures SSH key information during push processing
   - Stores key securely when approval is required

4. **SSH Key Forwarding Service** (`src/service/SSHKeyForwardingService.ts`)
   - Handles approved pushes using retained SSH keys
   - Provides fallback mechanisms for expired/missing keys

### Security Features

- **Encryption**: All stored SSH keys are encrypted using AES-256-GCM
- **Expiration**: Keys automatically expire after 24 hours
- **Secure Cleanup**: Memory is securely cleared when keys are removed
- **Environment-based Keys**: Encryption keys can be provided via environment variables

## Implementation Details

### SSH Key Capture Flow

1. User connects via SSH and authenticates with their public key
2. SSH server captures key information and stores it on the client connection
3. When a push is processed, the `captureSSHKey` processor:
   - Checks if this is an SSH push requiring approval
   - Stores SSH key information in the action for later use

### Approval and Push Flow

1. Push is approved via web interface or API
2. `SSHKeyForwardingService.executeApprovedPush()` is called
3. Service attempts to retrieve the user's SSH key from the agent
4. If key is available and valid:
   - Creates temporary SSH key file
   - Executes git push with user's credentials
   - Cleans up temporary files
5. If key is not available:
   - Falls back to proxy's SSH key
   - Logs the fallback for audit purposes

### Database Schema Changes

The `Push` type has been extended with:

```typescript
{
  encryptedSSHKey?: string;     // Encrypted SSH private key
  sshKeyExpiry?: Date;          // Key expiration timestamp
  protocol?: 'https' | 'ssh';   // Protocol used for the push
  userId?: string;              // User ID for the push
}
```

## Configuration

### Environment Variables

- `SSH_KEY_ENCRYPTION_KEY`: 32-byte hex string for SSH key encryption
- If not provided, keys are derived from the SSH host key

### SSH Configuration

Enable SSH support in `proxy.config.json`:

```json
{
  "ssh": {
    "enabled": true,
    "port": 2222,
    "hostKey": {
      "privateKeyPath": "./.ssh/host_key",
      "publicKeyPath": "./.ssh/host_key.pub"
    }
  }
}
```

## Security Considerations

### Encryption Key Management

- **Production**: Use `SSH_KEY_ENCRYPTION_KEY` environment variable with a securely generated 32-byte key
- **Development**: System derives keys from SSH host key (less secure but functional)

### Key Rotation

- SSH keys are automatically rotated every 24 hours
- Manual cleanup can be triggered via `SSHKeyManager.cleanupExpiredKeys()`

### Memory Security

- Private keys are stored in Buffer objects that are securely cleared
- Temporary files are created with restrictive permissions (0600)
- All temporary files are automatically cleaned up

## API Usage

### Adding SSH Key to Agent

```typescript
import { SSHKeyForwardingService } from './service/SSHKeyForwardingService';

// Add SSH key for a push
SSHKeyForwardingService.addSSHKeyForPush(
  pushId,
  privateKeyBuffer,
  publicKeyBuffer,
  'user@example.com',
);
```

### Executing Approved Push

```typescript
// Execute approved push with retained SSH key
const success = await SSHKeyForwardingService.executeApprovedPush(pushId);
```

### Cleanup

```typescript
// Manual cleanup of expired keys
await SSHKeyForwardingService.cleanupExpiredKeys();
```

## Monitoring and Logging

The system provides comprehensive logging for:

- SSH key capture and storage
- Key expiration and cleanup
- Push execution with user keys
- Fallback to proxy keys

Log prefixes:

- `[SSH Key Manager]`: Key encryption/decryption operations
- `[SSH Agent]`: In-memory key management
- `[SSH Forwarding]`: Push execution and key usage

## Future Enhancements

1. **SSH Agent Forwarding**: Implement true SSH agent forwarding instead of key storage
2. **Key Derivation**: Support for different key types (Ed25519, ECDSA, etc.)
3. **Audit Logging**: Enhanced audit trail for SSH key usage
4. **Key Rotation**: Automatic key rotation based on push frequency
5. **Integration**: Integration with external SSH key management systems

## Troubleshooting

### Common Issues

1. **Key Not Found**: Check if key has expired or was not properly captured
2. **Permission Denied**: Verify SSH key permissions and proxy configuration
3. **Fallback to Proxy Key**: Normal behavior when user key is unavailable

### Debug Commands

```bash
# Check SSH agent status
curl -X GET http://localhost:8080/api/v1/ssh/agent/status

# List active SSH keys
curl -X GET http://localhost:8080/api/v1/ssh/agent/keys

# Trigger cleanup
curl -X POST http://localhost:8080/api/v1/ssh/agent/cleanup
```

## Conclusion

The SSH key retention feature provides a seamless experience for users while maintaining security through encryption, expiration, and proper cleanup mechanisms. It eliminates the need for re-authentication while ensuring that SSH keys are not permanently stored or exposed.
