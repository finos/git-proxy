# SSH Setup Guide

Complete guide for developers to configure and use Git Proxy with SSH protocol.

## Overview

Git Proxy supports SSH protocol with full feature parity with HTTPS, including:

- SSH key-based authentication
- SSH agent forwarding (secure access without exposing private keys)
- Complete security scanning and validation
- Same 16-processor security chain as HTTPS

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

**For architecture details**, see [SSH_ARCHITECTURE.md](SSH_ARCHITECTURE.md)

---

## Prerequisites

- Git Proxy running and accessible (default: `localhost:2222`)
- SSH client installed (usually pre-installed on Linux/macOS)
- Access to the Git Proxy admin UI or database to register your SSH key

---

## Setup Steps

### 1. Generate SSH Key (if not already present)

```bash
# Check if you already have an SSH key
ls -la ~/.ssh/id_*.pub

# If no key exists, generate a new Ed25519 key
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter to accept default location (~/.ssh/id_ed25519)
# Optionally set a passphrase for extra security
```

### 2. Start ssh-agent and Load Key

```bash
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_ed25519
ssh-add -l  # Verify key loaded
```

**⚠️ Important: ssh-agent is per-terminal session**

The ssh-agent you start is **only available in that specific terminal window**. This means:

- If you run `ssh-add` in Terminal A, then try to `git push` from Terminal B → **it will fail**
- You must run git commands in the **same terminal** where you ran `ssh-add`
- Opening a new terminal requires running these commands again

Some operating systems (like macOS with Keychain) may share the agent across terminals automatically, but this is not guaranteed on all systems.

### 3. Register Public Key with Git Proxy

```bash
# Display your public key
cat ~/.ssh/id_ed25519.pub

# Register it via:
# - Git Proxy UI (http://localhost:8000)
# - Or directly in the database
```

### 4. Configure Git Remote

**For new repositories** (if remote doesn't exist yet):

```bash
git remote add origin ssh://git@git-proxy.example.com:2222/github.com/org/repo.git
```

**For existing repositories** (if remote already exists):

```bash
git remote set-url origin ssh://git@git-proxy.example.com:2222/github.com/org/repo.git
```

**Check current remote configuration**:

```bash
git remote -v
```

**Examples for different Git providers**:

```bash
# GitHub
ssh://git@git-proxy.example.com:2222/github.com/org/repo.git

# GitLab
ssh://git@git-proxy.example.com:2222/gitlab.com/org/repo.git
```

> **⚠️ Important:** The repository URL must end with `.git` or the SSH server will reject it.

### 5. Configure SSH Agent Forwarding

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

Edit `~/.ssh/config`:

```
Host git-proxy.example.com
  ForwardAgent yes
  IdentityFile ~/.ssh/id_ed25519
  Port 2222
```

**Custom Error Messages**: Administrators can customize the agent forwarding error message via `ssh.agentForwardingErrorMessage` in the proxy configuration.

---

## First Connection

When connecting for the first time, you'll see a host key verification warning:

```
The authenticity of host '[git-proxy.example.com]:2222' can't be established.
ED25519 key fingerprint is SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.
Are you sure you want to continue connecting (yes/no)?
```

This is **normal** and expected! Type `yes` to continue.

> **⚠️ Security Note**: If you see this warning on subsequent connections, it could indicate:
>
> - The proxy was reinstalled or the host key regenerated
> - A potential man-in-the-middle attack
>
> Contact your Git Proxy administrator to verify the fingerprint.

---

## Usage

Once configured, use Git normally:

```bash
# Push to remote through the proxy
git push origin main

# Pull from remote through the proxy
git pull origin main

# Clone a new repository through the proxy
git clone -c core.sshCommand="ssh -A" ssh://git@git-proxy.example.com:2222/github.com/org/repo.git
```

---

## Security Considerations

### SSH Agent Forwarding

SSH agent forwarding allows the proxy to use your SSH keys **without ever seeing them**. The private key remains on your local machine.

**How it works:**

1. Proxy needs to authenticate to GitHub/GitLab
2. Proxy requests signature from your local ssh-agent through a temporary channel
3. Your local agent signs the request using your private key
4. Signature is sent back to proxy
5. Proxy uses signature to authenticate to remote
6. Channel is immediately closed

**Security implications:**

- ✅ Private key never leaves your machine
- ✅ Proxy cannot use your key after the session ends
- ⚠️ Proxy can use your key during the session (for any operation, not just the current push)
- ⚠️ Only enable forwarding to trusted proxies

### Per-repository vs Per-host Configuration

**Per-repository** (`git config core.sshCommand "ssh -A"`):

- ✅ Explicit per-repo control
- ✅ Can selectively enable for trusted proxies only
- ❌ Must configure each repository

**Per-host** (`~/.ssh/config ForwardAgent yes`):

- ✅ Automatic for all repos using that host
- ✅ Convenient for frequent use
- ⚠️ Applies to all connections to that host

**Recommendation**: Use per-repository for maximum control, especially if you work with multiple Git Proxy instances.

---

## Advanced Configuration

### Custom SSH Port

If Git Proxy SSH server runs on a non-default port, specify it in the URL:

```bash
ssh://git@git-proxy.example.com:2222/github.com/org/repo.git
                                ^^^^
                            custom port
```

Or configure in `~/.ssh/config`:

```
Host git-proxy.example.com
  Port 2222
  ForwardAgent yes
```

### Using Different SSH Keys

If you have multiple SSH keys:

```bash
# Specify key in git config
git config core.sshCommand "ssh -A -i ~/.ssh/custom_key"

# Or in ~/.ssh/config
Host git-proxy.example.com
  IdentityFile ~/.ssh/custom_key
  ForwardAgent yes
```
