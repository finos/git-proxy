# SSH Feature Documentation

## Overview

The SSH feature enables secure Git operations over SSH protocol, providing an alternative to HTTPS for repository access. This implementation acts as a proxy between Git clients and the remote Git server (e.g., GitHub), with additional security and control capabilities.

## Configuration

The SSH feature can be configured in the main configuration file with the following options:

```json
{
  "ssh": {
    "enabled": true,
    "port": 22,
    "hostKey": {
      "privateKeyPath": "./.ssh/host_key",
      "publicKeyPath": "./.ssh/host_key.pub"
    }
  }
}
```

### Configuration Options

- `enabled`: Boolean flag to enable/disable SSH support
- `port`: Port number for the SSH server to listen on (default is 22)
- `hostKey`: Configuration for the server's SSH host key
  - `privateKeyPath`: Path to the private key file
  - `publicKeyPath`: Path to the public key file

## Authentication Methods

The SSH server supports two authentication methods:

1. **Public Key Authentication**

   - Users can authenticate using their SSH public keys
   - Keys are stored in the database and associated with user accounts
   - Supports various key types (RSA, ED25519, etc.)

2. **Password Authentication**
   - Users can authenticate using their username and password
   - Passwords are stored securely using bcrypt hashing
   - Only available if no public key is provided

## Connection Handling

The SSH server implements several features to ensure reliable connections:

- **Keepalive Mechanism**

  - Regular keepalive packets (every 15 seconds)
  - Configurable keepalive interval and maximum attempts
  - Helps prevent connection timeouts

- **Error Recovery**

  - Graceful handling of connection errors
  - Automatic recovery from temporary disconnections
  - Fallback mechanisms for authentication failures

- **Connection Timeouts**
  - 5-minute timeout for large repository operations
  - Configurable ready timeout (30 seconds by default)

## Git Protocol Support

The SSH server fully supports Git protocol operations:

- **Git Protocol Version 2**

  - Enabled by default for all connections
  - Improved performance and security

- **Command Execution**
  - Supports all standard Git commands
  - Proper handling of Git protocol streams
  - Efficient data transfer between client and server

## Security Features

1. **Host Key Verification**

   - Server uses a dedicated host key pair for the initial handshake between git proxy and user
   - Keys are stored securely in the filesystem
   - This key pair is used to establish the secure SSH connection and verify the server's identity to the client

2. **Authentication Chain**

   - Integrates with the existing authentication chain
   - Supports custom authentication plugins
   - Enforces access control policies

3. **Connection Security**
   - Secure key exchange
   - Encrypted data transmission
   - Protection against common SSH attacks

## Implementation Details

The SSH server is implemented using the `ssh2` library and includes:

- Custom SSH server class (`SSHServer`)
- Comprehensive error handling
- Detailed logging for debugging
- Support for large file transfers
- Efficient stream handling

## Usage

To use the SSH feature:

1. Ensure SSH is enabled in the configuration
2. Generate and configure the host key pair
3. Add user SSH keys to the database
4. Connect using standard Git SSH commands:

```bash
git clone git@your-proxy:username/repo.git
```

If other than default (22) port is used, git command will look like this:

```bash
git clone ssh://git@your-proxy:2222/username/repo.git
```

## Troubleshooting

Common issues and solutions:

1. **Connection Timeouts**

   - Check keepalive settings
   - Verify network connectivity
   - Ensure proper firewall configuration

2. **Authentication Failures**

   - Verify SSH key format
   - Check key association in database
   - Ensure proper permissions

3. **Performance Issues**
   - Adjust window size and packet size
   - Monitor connection timeouts
   - Check server resources

## Development

The SSH implementation includes comprehensive tests in `test/ssh/sshServer.test.js`. To run the tests:

```bash
npm test
```

## Future Improvements

Planned enhancements:

1. Move SSH configuration options (keep alive, timeouts, and other params) to config file
2. Enhance actions for SSH functionality
3. Improved error reporting
4. Additional security features
