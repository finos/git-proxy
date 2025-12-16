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

The **SSH host key** is the proxy server's cryptographic identity. It identifies the proxy to clients and prevents man-in-the-middle attacks.

**Auto-generated**: On first startup, git-proxy generates an Ed25519 host key stored in `.ssh/host_key` and `.ssh/host_key.pub`.

**Important**: The host key is NOT used for authenticating to GitHub/GitLab. Agent forwarding handles remote authentication using the client's keys.

**First connection warning**:

```
The authenticity of host '[localhost]:2222' can't be established.
ED25519 key fingerprint is SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.
Are you sure you want to continue connecting (yes/no)?
```

This is normal! If it appears on subsequent connections, it could indicate the proxy was reinstalled or a potential security issue.

---

## Client → Proxy Communication

### Client Setup

**1. Configure Git remote**:

```bash
# For GitHub
git remote add origin ssh://git@git-proxy.example.com:2222/github.com/org/repo.git

# For GitLab
git remote add origin ssh://git@git-proxy.example.com:2222/gitlab.com/org/repo.git
```

**2. Generate SSH key (if not already present)**:

```bash
# Check if you already have an SSH key
ls -la ~/.ssh/id_*.pub

# If no key exists, generate a new Ed25519 key
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter to accept default location (~/.ssh/id_ed25519)
# Optionally set a passphrase for extra security
```

**3. Start ssh-agent and load key**:

```bash
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_ed25519
ssh-add -l  # Verify key loaded
```

**⚠️ Important: ssh-agent is per-terminal session**

**4. Register public key with proxy**:

```bash
cat ~/.ssh/id_ed25519.pub
# Register via UI (http://localhost:8000) or database
```

**5. Configure SSH agent forwarding**:

⚠️ **Security Note**: Choose the most appropriate method for your security requirements.

**Option A: Per-repository (RECOMMENDED)**

```bash
# For existing repositories
cd /path/to/your/repo
git config core.sshCommand "ssh -A"

# For cloning new repositories
git clone -c core.sshCommand="ssh -A" ssh://git@git-proxy.example.com:2222/github.com/org/repo.git
```

**Option B: Per-host via SSH config**

```
Host git-proxy.example.com
  ForwardAgent yes
  IdentityFile ~/.ssh/id_ed25519
  Port 2222
```

**Custom Error Messages**: Administrators can customize the agent forwarding error message via `ssh.agentForwardingErrorMessage` in the proxy configuration.

---

## SSH Agent Forwarding

SSH agent forwarding allows the proxy to use the client's SSH keys **without ever receiving them**. The private key remains on the client's computer.

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

### Lazy Agent Pattern

The proxy uses a **lazy agent pattern** to minimize security exposure:

1. Agent channels are opened **on-demand** when GitHub requests authentication
2. Signatures are requested through the channel
3. Channels are **immediately closed** after receiving the response

This ensures agent access is only available during active authentication, not throughout the entire session.

---

## SSH Channels: Session vs Agent

Client → Proxy communication uses **two independent channels**:

### Session Channel (Git Protocol)

```
┌─────────────┐                        ┌─────────────┐
│   Client    │                        │    Proxy    │
│             │   Session Channel 0    │             │
│             │◄──────────────────────►│             │
│  Git Data   │   Git Protocol         │  Git Data   │
│             │   (upload/receive)     │             │
└─────────────┘                        └─────────────┘
```

Carries:

- Git commands (git-upload-pack, git-receive-pack)
- Git data (capabilities, refs, pack data)
- stdin/stdout/stderr of the command

### Agent Channel (Agent Forwarding)

```
┌─────────────┐                        ┌─────────────┐
│   Client    │                        │    Proxy    │
│             │                        │             │
│ ssh-agent   │   Agent Channel 1      │ LazyAgent   │
│    [Key]    │◄──────────────────────►│             │
│             │   (opened on-demand)   │             │
└─────────────┘                        └─────────────┘
```

Carries:

- Identity requests (list of public keys)
- Signature requests
- Agent responses

**The two channels are completely independent!**

---

## Git Capabilities Exchange

Git capabilities are the features supported by the server (e.g., `report-status`, `delete-refs`, `side-band-64k`). They're sent at the beginning of each session with available refs.

### Standard Flow (without proxy)

```
Client ──────────────→ GitHub (single connection)
       1. "git-receive-pack /github.com/org/repo.git"
       2. GitHub: capabilities + refs
       3. Client: pack data
       4. GitHub: "ok refs/heads/main"
```

### Proxy Flow (modified for security validation)

```
Client → Proxy                Proxy → GitHub
  │                              │
  │ 1. "git-receive-pack"        │
  │─────────────────────────────→│
  │                              │ CONNECTION 1
  │                              ├──────────────→ GitHub
  │                              │ "get capabilities"
  │                              │←─────────────┤
  │                              │ capabilities
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
  │                              │ capabilities (again) + response
  │ 5. response                  │
  │←─────────────────────────────┤ (skip duplicate capabilities)
```

### Why Two Connections?

**Core requirement**: Validate pack data BEFORE sending to GitHub (security chain).

**The SSH problem**:

1. Client expects capabilities **IMMEDIATELY** when requesting git-receive-pack
2. We need to **buffer** all pack data to validate it
3. If we waited to receive all pack data first → client blocks

**Solution**:

- **Connection 1**: Fetch capabilities immediately, send to client
- Client sends pack data while we **buffer** it
- **Security validation**: Chain verifies the pack data
- **Connection 2**: After approval, forward to GitHub

**Consequence**: GitHub sends capabilities again in the second connection. We skip these duplicate bytes and forward only the real response.

### HTTPS vs SSH Difference

In **HTTPS**, capabilities are exchanged in a separate request:

```
1. GET /info/refs?service=git-receive-pack  → capabilities
2. POST /git-receive-pack                    → pack data
```

In **SSH**, everything happens in a single conversational session. The proxy must fetch capabilities upfront to prevent blocking the client.

---

## Security Chain Validation

The security chain independently clones and analyzes repositories **before** accepting pushes. The proxy uses the **same protocol** as the client connection:

**SSH protocol:**
- Security chain clones via SSH using agent forwarding
- Uses the **client's SSH keys** (forwarded through agent)
- Preserves user identity throughout the entire flow
- Requires agent forwarding to be enabled

**HTTPS protocol:**
- Security chain clones via HTTPS using service token
- Uses the **proxy's credentials** (configured service token)
- Independent authentication from client

This ensures consistent authentication and eliminates protocol mixing. The client's chosen protocol determines both the end-to-end git operations and the internal security validation method.
