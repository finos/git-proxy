# SSH Proxy Architecture

Complete documentation of the SSH proxy architecture and operation for Git.

### Main Components

```
┌─────────────┐         ┌──────────────────┐         ┌──────────┐
│   Client    │ SSH     │    Git Proxy     │  SSH    │  GitHub  │
│ (Developer) ├────────→│  (Middleware)    ├────────→│ (Remote) │
└─────────────┘         └──────────────────┘         └──────────┘
                              ↓
                        ┌─────────────┐
                        │  Security   │
                        │    Chain    │
                        └─────────────┘
```

---

## SSH Host Key (Proxy Identity)

### What is the Host Key?

The **SSH host key** is the cryptographic identity of the proxy server, similar to an SSL/TLS certificate for HTTPS servers.

**Purpose**: Identifies the proxy server to clients and prevents man-in-the-middle attacks.

### Important Clarifications

⚠️ **WHAT THE HOST KEY IS:**
- The proxy server's identity (like an SSL certificate)
- Used when clients connect TO the proxy
- Verifies "this is the legitimate git-proxy server"
- Auto-generated on first startup if missing

⚠️ **WHAT THE HOST KEY IS NOT:**
- NOT used for authenticating to GitHub/GitLab
- NOT related to user SSH keys
- NOT used for remote Git operations
- Agent forwarding handles remote authentication (using the client's keys)

### Authentication Flow

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│  Developer  │                    │  Git Proxy  │                    │   GitHub    │
│             │                    │             │                    │             │
│ [User Key]  │  1. SSH Connect    │ [Host Key]  │                    │             │
│             ├───────────────────→│             │                    │             │
│             │  2. Verify Host Key│             │                    │             │
│             │←──────────────────┤             │                    │             │
│             │  3. Auth w/User Key│             │                    │             │
│             ├───────────────────→│             │                    │             │
│             │  ✓ Connected       │             │                    │             │
│             │                    │             │  4. Connect w/     │             │
│             │                    │             │  Agent Forwarding  │             │
│             │                    │             ├───────────────────→│             │
│             │                    │             │  5. GitHub requests│             │
│             │                    │             │  signature         │             │
│             │  6. Sign via agent │             │←──────────────────┤             │
│             │←───────────────────┤             │                    │             │
│             │  7. Signature      │             │  8. Forward sig    │             │
│             ├───────────────────→│             ├───────────────────→│             │
│             │                    │             │  ✓ Authenticated   │             │
└─────────────┘                    └─────────────┘                    └─────────────┘

Step 2: Client verifies proxy's HOST KEY
Step 3: Client authenticates to proxy with USER KEY
Steps 6-8: Proxy uses client's USER KEY (via agent) to authenticate to GitHub
```

### Configuration

The host key is **automatically managed** by git-proxy and stored in `.ssh/host_key`:

```
.ssh/
├── host_key           # Proxy's private key (auto-generated)
└── host_key.pub       # Proxy's public key (auto-generated)
```

**Auto-generation**: The host key is automatically generated on first startup using Ed25519 (modern, secure, fast).

**No user configuration needed**: The host key is an implementation detail and is not exposed in `proxy.config.json`.

### First Connection Warning

When clients first connect to the proxy, they'll see:

```
The authenticity of host '[localhost]:2222' can't be established.
ED25519 key fingerprint is SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.
Are you sure you want to continue connecting (yes/no)?
```

This is normal! It means the client is verifying the proxy's host key for the first time.

⚠️ **Security**: If this message appears on subsequent connections (after the first), it could indicate:
- The proxy's host key was regenerated
- A potential man-in-the-middle attack
- The proxy was reinstalled or migrated

---

## Client → Proxy Communication

### Client Setup

The Git client uses SSH to communicate with the proxy. Minimum required configuration:

**1. Configure Git remote**:

```bash
git remote add origin ssh://user@git-proxy.example.com:2222/org/repo.git
```

**2. Start ssh-agent and load key**:

```bash
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_ed25519
ssh-add -l  # Verify key loaded
```

**3. Register public key with proxy**:

```bash
# Copy the public key
cat ~/.ssh/id_ed25519.pub

# Register it via UI (http://localhost:8000) or database
# The key must be in the proxy database for Client → Proxy authentication
```

**4. Configure SSH agent forwarding**:

⚠️ **Security Note**: SSH agent forwarding can be a security risk if enabled globally. Choose the most appropriate method for your security requirements:

**Option A: Per-repository (RECOMMENDED - Most Secure)**

This limits agent forwarding to only this repository's Git operations.

For **existing repositories**:

```bash
cd /path/to/your/repo
git config core.sshCommand "ssh -A"
```

For **cloning new repositories**, use the `-c` flag to set the configuration during clone:

```bash
# Clone with per-repository agent forwarding (recommended)
git clone -c core.sshCommand="ssh -A" ssh://user@git-proxy.example.com:2222/org/repo.git

# The configuration is automatically saved in the cloned repository
cd repo
git config core.sshCommand  # Verify: should show "ssh -A"
```

**Alternative for cloning**: Use Option B or C temporarily for the initial clone, then switch to per-repository configuration:

```bash
# Clone using SSH config (Option B) or global config (Option C)
git clone ssh://user@git-proxy.example.com:2222/org/repo.git

# Then configure for this repository only
cd repo
git config core.sshCommand "ssh -A"

# Now you can remove ForwardAgent from ~/.ssh/config if desired
```

**Option B: Per-host via SSH config (Moderately Secure)**

Add to `~/.ssh/config`:

```
Host git-proxy.example.com
  ForwardAgent yes
  IdentityFile ~/.ssh/id_ed25519
  Port 2222
```

This enables agent forwarding only when connecting to the specific proxy host.

**Option C: Global Git config (Least Secure - Not Recommended)**

```bash
# Enables agent forwarding for ALL Git operations
git config --global core.sshCommand "ssh -A"
```

⚠️ **Warning**: This enables agent forwarding for all Git repositories. Only use this if you trust all Git servers you interact with. See [MITRE ATT&CK T1563.001](https://attack.mitre.org/techniques/T1563/001/) for security implications.

**Custom Error Messages**: Administrators can customize the agent forwarding error message by setting `ssh.agentForwardingErrorMessage` in the proxy configuration to match your organization's security policies.

### How It Works

When you run `git push`, Git translates the command into SSH:

```bash
# User:
git push origin main

# Git internally:
ssh -A git-proxy.example.com "git-receive-pack '/org/repo.git'"
```

The `-A` flag (agent forwarding) is activated automatically if configured in `~/.ssh/config`

---

### SSH Channels: Session vs Agent

**IMPORTANT**: Client → Proxy communication uses **different channels** than agent forwarding:

#### Session Channel (Git Protocol)

```
┌─────────────┐                        ┌─────────────┐
│   Client    │                        │    Proxy    │
│             │   Session Channel 0    │             │
│             │◄──────────────────────►│             │
│  Git Data   │   Git Protocol         │  Git Data   │
│             │   (upload/receive)     │             │
└─────────────┘                        └─────────────┘
```

This channel carries:

- Git commands (git-upload-pack, git-receive-pack)
- Git data (capabilities, refs, pack data)
- stdin/stdout/stderr of the command

#### Agent Channel (Agent Forwarding)

```
┌─────────────┐                        ┌─────────────┐
│   Client    │                        │    Proxy    │
│             │                        │             │
│ ssh-agent   │   Agent Channel 1      │ LazyAgent   │
│    [Key]    │◄──────────────────────►│             │
│             │   (opened on-demand)   │             │
└─────────────┘                        └─────────────┘
```

This channel carries:

- Identity requests (list of public keys)
- Signature requests
- Agent responses

**The two channels are completely independent!**

### Complete Example: git push with Agent Forwarding

**What happens**:

```
CLIENT                              PROXY                          GITHUB

  │ ssh -A git-proxy.example.com   │                               │
  ├────────────────────────────────►│                               │
  │  Session Channel                │                               │
  │                                 │                               │
  │  "git-receive-pack /org/repo"   │                               │
  ├────────────────────────────────►│                               │
  │                                 │                               │
  │                                 │  ssh github.com               │
  │                                 ├──────────────────────────────►│
  │                                 │  (needs authentication)       │
  │                                 │                               │
  │  Agent Channel opened           │                               │
  │◄────────────────────────────────┤                               │
  │                                 │                               │
  │  "Sign this challenge"          │                               │
  │◄────────────────────────────────┤                               │
  │                                 │                               │
  │  [Signature]                    │                               │
  │────────────────────────────────►│                               │
  │                                 │  [Signature]                  │
  │                                 ├──────────────────────────────►│
  │  Agent Channel closed           │  (authenticated!)             │
  │◄────────────────────────────────┤                               │
  │                                 │                               │
  │  Git capabilities               │  Git capabilities             │
  │◄────────────────────────────────┼───────────────────────────────┤
  │  (via Session Channel)          │  (forwarded)                  │
  │                                 │                               │
```

---

## Core Concepts

### 1. SSH Agent Forwarding

SSH agent forwarding allows the proxy to use the client's SSH keys **without ever receiving them**. The private key remains on the client's computer.

#### How does it work?

```
┌──────────┐                    ┌───────────┐                  ┌──────────┐
│  Client  │                    │   Proxy   │                  │  GitHub  │
│          │                    │           │                  │          │
│ ssh-agent│                    │           │                  │          │
│    ↑     │                    │           │                  │          │
│    │     │  Agent Forwarding  │           │                  │          │
│ [Key]    │◄──────────────────►│  Lazy     │                  │          │
│          │     SSH Channel    │  Agent    │                  │          │
└──────────┘                    └───────────┘                  └──────────┘
     │                                │                              │
     │                                │   1. GitHub needs signature  │
     │                                │◄─────────────────────────────┤
     │                                │                              │
     │   2. Open temp agent channel   │                              │
     │◄───────────────────────────────┤                              │
     │                                │                              │
     │   3. Request signature         │                              │
     │◄───────────────────────────────┤                              │
     │                                │                              │
     │   4. Return signature          │                              │
     │───────────────────────────────►│                              │
     │                                │                              │
     │   5. Close channel             │                              │
     │◄───────────────────────────────┤                              │
     │                                │   6. Forward signature       │
     │                                ├─────────────────────────────►│
```

#### Lazy Agent Pattern

The proxy does **not** keep an agent channel open permanently. Instead:

1. When GitHub requires a signature, we open a **temporary channel**
2. We request the signature through the channel
3. We **immediately close** the channel after the response

#### Implementation Details and Limitations

**Important**: The SSH agent forwarding implementation is more complex than typical due to limitations in the `ssh2` library.

**The Problem:**
The `ssh2` library does not expose public APIs for **server-side** SSH agent forwarding. While ssh2 has excellent support for client-side agent forwarding (connecting TO an agent), it doesn't provide APIs for the server side (accepting agent channels FROM clients and forwarding requests).

**Our Solution:**
We implemented agent forwarding by directly manipulating ssh2's internal structures:

- `_protocol`: Internal protocol handler
- `_chanMgr`: Internal channel manager
- `_handlers`: Event handler registry

**Code reference** (`AgentForwarding.ts`):

```typescript
// Uses ssh2 internals - no public API available
const proto = (client as any)._protocol;
const chanMgr = (client as any)._chanMgr;
(proto as any)._handlers.CHANNEL_OPEN_CONFIRMATION = handlerWrapper;
```

**Risks:**

- **Fragile**: If ssh2 changes internals, this could break
- **Maintenance**: Requires monitoring ssh2 updates
- **No type safety**: Uses `any` casts to bypass TypeScript

**Upstream Work:**
There are open PRs in the ssh2 repository to add proper server-side agent forwarding APIs:

- [#781](https://github.com/mscdex/ssh2/pull/781) - Add support for server-side agent forwarding
- [#1468](https://github.com/mscdex/ssh2/pull/1468) - Related improvements

**Future Improvements:**
Once ssh2 adds public APIs for server-side agent forwarding, we should:

1. Remove internal API usage in `openTemporaryAgentChannel()`
2. Use the new public APIs
3. Improve type safety

### 2. Git Capabilities

"Capabilities" are the features supported by the Git server (e.g., `report-status`, `delete-refs`, `side-band-64k`). They are sent at the beginning of each Git session along with available refs.

#### How does it work normally (without proxy)?

**Standard Git push flow**:

```
Client ──────────────→ GitHub (single connection)
       1. "git-receive-pack /repo.git"
       2. GitHub: capabilities + refs
       3. Client: pack data
       4. GitHub: "ok refs/heads/main"
```

Capabilities are exchanged **only once** at the beginning of the connection.

#### How did we modify the flow in the proxy?

**Our modified flow**:

```
Client → Proxy                Proxy → GitHub
  │                              │
  │ 1. "git-receive-pack"        │
  │─────────────────────────────→│
  │                              │ CONNECTION 1
  │                              ├──────────────→ GitHub
  │                              │ "get capabilities"
  │                              │←─────────────┤
  │                              │ capabilities (500 bytes)
  │ 2. capabilities              │ DISCONNECT
  │←─────────────────────────────┤
  │                              │
  │ 3. pack data                 │
  │─────────────────────────────→│ (BUFFERED!)
  │                              │
  │                              │ 4. Security validation
  │                              │
  │                              │ CONNECTION 2
  │                              ├──────────────→ GitHub
  │                              │ pack data
  │                              │←─────────────┤
  │                              │ capabilities (500 bytes AGAIN!)
  │                              │ + actual response
  │ 5. response                  │
  │←─────────────────────────────┤ (skip capabilities, forward response)
```

#### Why this change?

**Core requirement**: Validate pack data BEFORE sending it to GitHub (security chain).

**Difference with HTTPS**:

In **HTTPS**, capabilities are exchanged in a **separate** HTTP request:

```
1. GET /info/refs?service=git-receive-pack  → capabilities + refs
2. POST /git-receive-pack                    → pack data (no capabilities)
```

The HTTPS proxy simply forwards the GET, then buffers/validates the POST.

In **SSH**, everything happens in **a single conversational session**:

```
Client → Proxy: "git-receive-pack" → expects capabilities IMMEDIATELY in the same session
```

We can't say "make a separate request". The client blocks if we don't respond immediately.

**SSH Problem**:

1. The client expects capabilities **IMMEDIATELY** when requesting git-receive-pack
2. But we need to **buffer** all pack data to validate it
3. If we waited to receive all pack data BEFORE fetching capabilities → the client blocks

**Solution**:

- **Connection 1**: Fetch capabilities immediately, send to client
- The client can start sending pack data
- We **buffer** the pack data (we don't send it yet!)
- **Validation**: Security chain verifies the pack data
- **Connection 2**: Only AFTER approval, we send to GitHub

**Consequence**:

- GitHub sees the second connection as a **new session**
- It resends capabilities (500 bytes) as it would normally
- We must **skip** these 500 duplicate bytes
- We forward only the real response: `"ok refs/heads/main\n"`

### 3. Security Chain Validation Uses HTTPS

**Important**: Even though the client uses SSH to connect to the proxy, the **security chain validation** (pullRemote action) clones the repository using **HTTPS**.

The security chain needs to independently clone and analyze the repository **before** accepting the push. This validation is separate from the SSH git protocol flow and uses HTTPS because:

1. Validation must work regardless of SSH agent forwarding state
2. Uses proxy's own credentials (service token), not client's keys
3. HTTPS is simpler for automated cloning/validation tasks

The two protocols serve different purposes:

- **SSH**: End-to-end git operations (preserves user identity)
- **HTTPS**: Internal security validation (uses proxy credentials)
