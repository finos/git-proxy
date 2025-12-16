### GitProxy SSH Data Flow

⚠️ **Note**: This document is outdated. See [SSH_ARCHITECTURE.md](docs/SSH_ARCHITECTURE.md) for current implementation details.

**Key changes since this document was written:**
- The proxy now uses SSH agent forwarding instead of its own host key for remote authentication
- The host key is ONLY used to identify the proxy server to clients (like an SSL certificate)
- Remote authentication uses the client's SSH keys via agent forwarding

---

## High-Level Flow (Current Implementation)

1.  **Client Connection:**
    - SSH client connects to the proxy server's listening port
    - The `ssh2.Server` instance receives the connection

2.  **Proxy Authentication (Client → Proxy):**
    - Server requests authentication
    - **Public Key Auth:**
      - Client sends its public key
      - Proxy queries database (`db.findUserBySSHKey()`)
      - If found, auth succeeds
    - **Password Auth:**
      - Client sends username/password
      - Proxy verifies with database (`db.findUser()` + bcrypt)
      - If valid, auth succeeds
    - **SSH Host Key**: Proxy presents its host key to identify itself to the client

3.  **Session Ready & Command Execution:**
    - Client requests session
    - Client executes Git command (`git-upload-pack` or `git-receive-pack`)
    - Proxy extracts repository path from command

4.  **Security Chain Validation:**
    - Proxy constructs simulated request object
    - Calls `chain.executeChain(req)` to apply security rules
    - If blocked, error message sent to client and flow stops

5.  **Connect to Remote Git Server (GitHub/GitLab):**
    - Proxy initiates new SSH connection to remote server
    - **Authentication Method: SSH Agent Forwarding**
      - Proxy uses client's SSH agent (via agent forwarding)
      - Client's private key remains on client machine
      - Proxy requests signatures from client's agent as needed
      - GitHub/GitLab sees the client's SSH key, not the proxy's host key

6.  **Data Proxying:**
    - Git protocol data flows bidirectionally:
      - Client → Proxy → Remote
      - Remote → Proxy → Client
    - Proxy buffers and validates data as needed

7.  **Stream Teardown:**
    - Handles connection cleanup for both client and remote connections
    - Manages keepalives and timeouts

---

## SSH Host Key (Proxy Identity)

**Purpose**: The SSH host key identifies the PROXY SERVER to connecting clients.

**What it IS:**
- The proxy's cryptographic identity (like an SSL certificate)
- Used when clients connect TO the proxy
- Automatically generated in `.ssh/host_key` on first startup
- NOT user-configurable (implementation detail)

**What it IS NOT:**
- NOT used for authenticating to GitHub/GitLab
- NOT related to user SSH keys
- Agent forwarding handles remote authentication

**Storage location**:
```
.ssh/
├── host_key           # Auto-generated proxy private key (Ed25519)
└── host_key.pub       # Auto-generated proxy public key
```

No configuration needed - the host key is managed automatically by git-proxy.

---

For detailed technical information about the SSH implementation, see [SSH_ARCHITECTURE.md](docs/SSH_ARCHITECTURE.md).
