# Local Git Server

This directory contains the local git HTTP server used by GitProxy's end-to-end test suite. It provides an isolated environment for testing real git operations without requiring external services.

For instructions on running E2E tests, managing the Docker environment, and interacting with test repositories, see the [End-to-End Tests](../CONTRIBUTING.md#end-to-end-tests) section of CONTRIBUTING.md.

## What it does

The git server is an Apache HTTP container that serves bare git repositories over HTTP via `git-http-backend`. A Python CGI wrapper (`git-capture-wrapper.py`) sits in front of the git backend to capture raw protocol data for every operation.

```
Git CLI
  │ HTTP
  ▼
GitProxy (optional, port 8000)
  │
  ▼
Apache HTTP Server (git-server)
  │ CGI
  ▼
git-capture-wrapper.py ──► saves request/response to /var/git-captures
  │
  ▼
git-http-backend
  │
  ▼
Bare git repositories (/var/git/owner/repo.git)
```

## Files

| File                     | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `Dockerfile`             | Defines the git-server container (Apache, git, Python)        |
| `httpd.conf`             | Apache configuration for git HTTP backend and CGI             |
| `init-repos.sh`          | Creates and populates test repositories on container startup  |
| `git-capture-wrapper.py` | CGI wrapper that captures git protocol request/response data  |
| `extract-captures.sh`    | Extracts captured data from the running container to the host |
| `extract-pack.py`        | Extracts PACK files from captured request binaries            |
| `generate-cert.sh`       | Generates self-signed HTTPS certificates for the server       |

## Data capture system

The capture wrapper records three files per git operation into `/var/git-captures/` inside the container:

| File             | Contents                                                   |
| ---------------- | ---------------------------------------------------------- |
| `*.request.bin`  | Raw HTTP request body (includes PACK data for pushes)      |
| `*.response.bin` | Raw HTTP response                                          |
| `*.metadata.txt` | Human-readable metadata (timestamp, service, paths, sizes) |

Filename pattern: `{YYYYMMDD}-{HHMMSS}-{microseconds}-{service}-{repo}.{type}.{ext}`

### Extracting captures and PACK files

```bash
cd localgit

# Copy all captures from the container to a local directory
./extract-captures.sh ./captured-data

# Extract the PACK portion from a push request capture
./extract-pack.py ./captured-data/*receive-pack*.request.bin output.pack

# Verify with git
git index-pack output.pack
git verify-pack -v output.pack
```

### Generating test fixtures

Captured data can be copied into `test/fixtures/` for use in unit tests:

```bash
# 1. Perform a git operation against the running environment
# 2. Extract the capture
./extract-captures.sh ./my-captures

# 3. Copy to test fixtures
cp ./my-captures/*receive-pack*.request.bin ../test/fixtures/my-scenario.bin
```

## Customization

**Add repositories**: Edit `init-repos.sh`, then rebuild (`docker compose build --no-cache git-server`).

**Toggle data capture**: Set `GIT_CAPTURE_ENABLE=0` in `docker-compose.yml` under `git-server.environment` to disable.

**Modify Apache**: Edit `httpd.conf` for authentication, CGI, or other server changes.
