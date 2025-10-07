# Local Git Server for End-to-End Testing

This directory contains a complete end-to-end testing environment for GitProxy, including:

- **Local Git HTTP Server**: Apache-based git server with test repositories
- **MongoDB Instance**: Database for GitProxy state management
- **GitProxy Server**: Configured to proxy requests to the local git server
- **Data Capture System**: Captures raw git protocol data for low-level testing

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Test Repositories](#test-repositories)
- [Basic Usage](#basic-usage)
- [Advanced Use](#advanced-use)
  - [Capturing Git Protocol Data](#capturing-git-protocol-data)
  - [Extracting PACK Files](#extracting-pack-files)
  - [Generating Test Fixtures](#generating-test-fixtures)
  - [Debugging PACK Parsing](#debugging-pack-parsing)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Commands Reference](#commands-reference)

---

## Overview

This testing setup provides an isolated environment for developing and testing GitProxy without requiring external git services. It's particularly useful for:

1. **Integration Testing**: Full end-to-end tests with real git operations
2. **Protocol Analysis**: Capturing and analyzing git HTTP protocol data
3. **Test Fixture Generation**: Creating binary test data from real git operations
4. **Low-Level Debugging**: Extracting and inspecting PACK files for parser development

### How It Fits Into the Codebase

```
git-proxy/
├── src/                          # GitProxy source code
├── test/                         # Unit and integration tests
│   ├── fixtures/                 # Test data (can be generated from captures)
│   └── integration/              # Integration tests using this setup
├── tests/e2e/                    # End-to-end tests
├── localgit/                     # THIS DIRECTORY
│   ├── Dockerfile                # Git server container definition
│   ├── docker-compose.yml        # Full test environment orchestration
│   ├── init-repos.sh             # Creates test repositories
│   ├── git-capture-wrapper.py   # Captures git protocol data
│   ├── extract-captures.sh      # Extracts captures from container
│   └── extract-pack.py          # Extracts PACK files from captures
└── docker-compose.yml            # References localgit/ for git-server service
```

---

## Quick Start

### 1. Start the Test Environment

```bash
# From the project root
docker compose up -d

# This starts:
# - git-server (port 8080)
# - mongodb (port 27017)
# - git-proxy (ports 8000, 8081)
```

### 2. Verify Services

```bash
# Check all services are running
docker compose ps

# Should show:
# - git-proxy (git-proxy service)
# - mongodb (database)
# - git-server (local git HTTP server)
```

### 3. Test Git Operations

```bash
# Clone a test repository
git clone http://admin:admin123@localhost:8080/coopernetes/test-repo.git
cd test-repo

# Make changes
echo "Test data $(date)" > test-file.txt
git add test-file.txt
git commit -m "Test commit"

# Push (this will be captured automatically)
git push origin main
```

### 4. Test Through GitProxy

```bash
# Clone through the proxy (port 8000)
git clone http://admin:admin123@localhost:8000/coopernetes/test-repo.git
```

---

## Architecture

### Component Diagram

```
┌─────────────┐
│   Git CLI   │
└──────┬──────┘
       │ HTTP (port 8080 or 8000)
       ▼
┌─────────────────────────┐
│   GitProxy (optional)   │  ← Port 8000 (proxy)
│   - Authorization       │  ← Port 8081 (UI)
│   - Logging             │
│   - Policy enforcement  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│   Apache HTTP Server    │  ← Port 8080 (direct)
│   (git-server)          │
└──────┬──────────────────┘
       │ CGI
       ▼
┌──────────────────────────────────┐
│  git-capture-wrapper.py          │
│  ├─ Capture request body         │
│  ├─ Save to /var/git-captures    │
│  ├─ Forward to git-http-backend  │
│  └─ Capture response             │
└──────┬───────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│  git-http-backend       │
│  (actual git processing)│
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Git Repositories       │
│  /var/git/owner/repo.git│
└─────────────────────────┘
```

### Network Configuration

All services run in the `git-network` Docker network:

- **git-server**: Hostname `git-server`, accessible at `http://git-server:8080` internally
- **mongodb**: Hostname `mongodb`, accessible at `mongodb://mongodb:27017` internally
- **git-proxy**: Hostname `git-proxy`, accessible at `http://git-proxy:8000` internally

External access:

- Git Server: `http://localhost:8080`
- GitProxy: `http://localhost:8000` (git operations), `http://localhost:8081` (UI)
- MongoDB: `localhost:27017`

---

## Test Repositories

The git server is initialized with test repositories in the following structure:

```
/var/git/
├── coopernetes/
│   └── test-repo.git          # Simple test repository
└── finos/
    └── git-proxy.git          # Simulates the GitProxy project
```

### Authentication

Basic authentication is configured with two users:

| Username   | Password   | Purpose                   |
| ---------- | ---------- | ------------------------- |
| `admin`    | `admin123` | Full access to all repos  |
| `testuser` | `user123`  | Standard user for testing |

### Repository Contents

**coopernetes/test-repo.git**:

- `README.md`: Simple test repository description
- `hello.txt`: Basic text file

**finos/git-proxy.git**:

- `README.md`: GitProxy project description
- `package.json`: Simulated project structure
- `LICENSE`: Apache 2.0 license

---

## Basic Usage

### Cloning Repositories

```bash
# Direct from git-server
git clone http://admin:admin123@localhost:8080/coopernetes/test-repo.git

# Through GitProxy
git clone http://admin:admin123@localhost:8000/coopernetes/test-repo.git
```

### Push and Pull Operations

```bash
cd test-repo

# Make changes
echo "New content" > newfile.txt
git add newfile.txt
git commit -m "Add new file"

# Push
git push origin main

# Pull
git pull origin main
```

### Viewing Logs

```bash
# GitProxy logs
docker compose logs -f git-proxy

# Git server logs
docker compose logs -f git-server

# MongoDB logs
docker compose logs -f mongodb
```

---

## Advanced Use

### Capturing Git Protocol Data

The git server automatically captures raw HTTP request/response data for all git operations. This is invaluable for:

- Creating test fixtures for unit tests
- Debugging protocol-level issues
- Understanding git's wire protocol
- Testing PACK file parsers

#### How Data Capture Works

The `git-capture-wrapper.py` CGI script intercepts all git HTTP requests:

1. **Captures request body** (e.g., PACK file during push)
2. **Forwards to git-http-backend** (actual git processing)
3. **Captures response** (e.g., unpack status)
4. **Saves three files** per operation:
   - `.request.bin`: Raw HTTP request body (binary)
   - `.response.bin`: Raw HTTP response (binary)
   - `.metadata.txt`: Human-readable metadata

#### Captured File Format

**Filename Pattern**: `{timestamp}-{service}-{repo}.{type}.{ext}`

Example: `20251001-185702-925704-receive-pack-_coopernetes_test-repo.request.bin`

- **timestamp**: `YYYYMMDD-HHMMSS-microseconds`
- **service**: `receive-pack` (push) or `upload-pack` (fetch/pull)
- **repo**: Repository path with slashes replaced by underscores

#### Extracting Captures

```bash
cd localgit

# Extract all captures to a local directory
./extract-captures.sh ./captured-data

# View what was captured
ls -lh ./captured-data/

# Read metadata
cat ./captured-data/*.metadata.txt
```

**Example Metadata**:

```
Timestamp: 2025-10-01T18:57:02.925894
Service: receive-pack
Request Method: POST
Path Info: /coopernetes/test-repo.git/git-receive-pack
Content Type: application/x-git-receive-pack-request
Content Length: 711
Request Body Size: 711 bytes
Response Size: 216 bytes
Exit Code: 0
```

### Extracting PACK Files

The `.request.bin` file for a push operation contains:

1. **Pkt-line commands**: Ref updates in git's pkt-line format
2. **Flush packet**: `0000` marker
3. **PACK data**: Binary PACK file starting with "PACK" signature

The `extract-pack.py` script extracts just the PACK portion:

```bash
# Extract PACK from captured request
./extract-pack.py ./captured-data/*receive-pack*.request.bin output.pack

# Output:
# Found PACK data at offset 173
# PACK signature: b'PACK'
# PACK version: 2
# Number of objects: 3
# PACK size: 538 bytes
```

#### Working with Extracted PACK Files

```bash
# Index the PACK file (required before verify)
git index-pack output.pack

# Verify the PACK file
git verify-pack -v output.pack

# Output shows objects:
# 95fbb70... commit 432 313 12
# 8c028ba... tree   44 55 325
# a0b4110... blob   47 57 380
# non delta: 3 objects
# output.pack: ok

# Unpack objects to inspect
git unpack-objects < output.pack
```

### Generating Test Fixtures

Use captured data to create test fixtures for your test suite:

#### Workflow

```bash
# 1. Perform a specific git operation
git clone http://admin:admin123@localhost:8080/coopernetes/test-repo.git
cd test-repo
# ... create specific test scenario ...
git push

# 2. Extract the capture
cd ../localgit
./extract-captures.sh ./test-scenario-captures

# 3. Copy to test fixtures
cp ./test-scenario-captures/*receive-pack*.request.bin \
   ../test/fixtures/my-test-scenario.bin

# 4. Use in tests
# test/mytest.js:
# const fs = require('fs');
# const testData = fs.readFileSync('./fixtures/my-test-scenario.bin');
# const result = await parsePush(testData);
```

#### Example: Creating a Force-Push Test Fixture

```bash
# Create a force-push scenario
git clone http://admin:admin123@localhost:8080/coopernetes/test-repo.git
cd test-repo
git reset --hard HEAD~1
echo "force push test" > force.txt
git add force.txt
git commit -m "Force push test"
git push --force origin main

# Extract and save
cd ../localgit
./extract-captures.sh ./force-push-capture
cp ./force-push-capture/*receive-pack*.request.bin \
   ../test/fixtures/force-push.bin
```

### Debugging PACK Parsing

When developing or debugging PACK file parsers:

#### Compare Your Parser with Git's

```bash
# 1. Extract captures
./extract-captures.sh ./debug-data

# 2. Extract PACK
./extract-pack.py ./debug-data/*receive-pack*.request.bin debug.pack

# 3. Use git to verify expected output
git index-pack debug.pack
git verify-pack -v debug.pack > expected-objects.txt

# 4. Run your parser
node -e "
const fs = require('fs');
const data = fs.readFileSync('./debug-data/*receive-pack*.request.bin');
// Your parsing code
const result = myPackParser(data);
console.log(JSON.stringify(result, null, 2));
" > my-parser-output.txt

# 5. Compare
diff expected-objects.txt my-parser-output.txt
```

#### Inspect Binary Data

```bash
# View hex dump of request
hexdump -C ./captured-data/*.request.bin | head -50

# Find PACK signature
grep -abo "PACK" ./captured-data/*.request.bin

# Extract pkt-line commands (before PACK)
head -c 173 ./captured-data/*.request.bin | hexdump -C
```

#### Use in Node.js Tests

```javascript
const fs = require('fs');

// Read captured data
const capturedData = fs.readFileSync(
  './captured-data/20250101-120000-receive-pack-test-repo.request.bin',
);

console.log('Total size:', capturedData.length, 'bytes');

// Find PACK offset
const packIdx = capturedData.indexOf(Buffer.from('PACK'));
console.log('PACK starts at offset:', packIdx);

// Extract PACK header
const packHeader = capturedData.slice(packIdx, packIdx + 12);
console.log('PACK header:', packHeader.toString('hex'));

// Parse PACK version and object count
const version = packHeader.readUInt32BE(4);
const numObjects = packHeader.readUInt32BE(8);
console.log(`PACK v${version}, ${numObjects} objects`);

// Test your parser
const result = await myPackParser(capturedData);
assert.equal(result.objectCount, numObjects);
```

---

## Configuration

### Enable/Disable Data Capture

Edit `docker-compose.yml`:

```yaml
git-server:
  environment:
    - GIT_CAPTURE_ENABLE=1 # 1 to enable, 0 to disable
```

Then restart:

```bash
docker compose restart git-server
```

### Add More Test Repositories

Edit `localgit/init-repos.sh` to add more repositories:

```bash
# Add a new owner
OWNERS=("owner1" "owner2" "newowner")

# Create a new repository
create_bare_repo "newowner" "new-repo.git"
add_content_to_repo "newowner" "new-repo.git"

# Add content...
cat > README.md << 'EOF'
# New Test Repository
EOF

git add .
git commit -m "Initial commit"
git push origin main
```

Rebuild the container:

```bash
docker compose down
docker compose build --no-cache git-server
docker compose up -d
```

### Modify Apache Configuration

Edit `localgit/httpd.conf` to change Apache settings (authentication, CGI, etc.).

### Change MongoDB Configuration

Edit `docker-compose.yml` to modify MongoDB settings:

```yaml
mongodb:
  environment:
    - MONGO_INITDB_DATABASE=gitproxy
    - MONGO_INITDB_ROOT_USERNAME=admin # Optional
    - MONGO_INITDB_ROOT_PASSWORD=secret # Optional
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check service status
docker compose ps

# View logs
docker compose logs git-server
docker compose logs mongodb
docker compose logs git-proxy

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Git Operations Fail

```bash
# Check git-server logs
docker compose logs git-server

# Test git-http-backend directly
docker compose exec git-server /usr/lib/git-core/git-http-backend

# Verify repository permissions
docker compose exec git-server ls -la /var/git/coopernetes/
```

### No Captures Created

```bash
# Verify capture is enabled
docker compose exec git-server env | grep GIT_CAPTURE

# Check capture directory permissions
docker compose exec git-server ls -ld /var/git-captures

# Should be: drwxr-xr-x www-data www-data

# Check wrapper is executable
docker compose exec git-server ls -l /usr/local/bin/git-capture-wrapper.py

# View Apache error logs
docker compose logs git-server | grep -i error
```

### Permission Errors

```bash
# Fix capture directory permissions
docker compose exec git-server chown -R www-data:www-data /var/git-captures

# Fix repository permissions
docker compose exec git-server chown -R www-data:www-data /var/git
```

### Clone Shows HEAD Warnings

This has been fixed in the current version. If you see warnings:

```bash
# Rebuild with latest init-repos.sh
docker compose down
docker compose build --no-cache git-server
docker compose up -d
```

The fix ensures repositories are created with `--initial-branch=main` and HEAD is explicitly set to `refs/heads/main`.

### MongoDB Connection Issues

```bash
# Check MongoDB is running
docker compose ps mongodb

# Test connection
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check GitProxy can reach MongoDB
docker compose exec git-proxy ping -c 3 mongodb
```

---

## Commands Reference

### Container Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Rebuild a specific service
docker compose build --no-cache git-server

# View logs
docker compose logs -f git-proxy
docker compose logs -f git-server
docker compose logs -f mongodb

# Restart a service
docker compose restart git-server

# Execute command in container
docker compose exec git-server bash
```

### Data Capture Operations

```bash
# Extract captures from container
cd localgit
./extract-captures.sh ./captured-data

# Extract PACK file
./extract-pack.py ./captured-data/*receive-pack*.request.bin output.pack

# Verify PACK file
git index-pack output.pack
git verify-pack -v output.pack

# Clear captures in container
docker compose exec git-server rm -f /var/git-captures/*

# View captures in container
docker compose exec git-server ls -lh /var/git-captures/

# Count captures
docker compose exec git-server sh -c "ls -1 /var/git-captures/*.bin | wc -l"
```

### Git Operations

```bash
# Clone directly from git-server
git clone http://admin:admin123@localhost:8080/coopernetes/test-repo.git

# Clone through GitProxy
git clone http://admin:admin123@localhost:8000/coopernetes/test-repo.git

# Push changes
cd test-repo
echo "test" > test.txt
git add test.txt
git commit -m "test"
git push origin main

# Force push
git push --force origin main

# Fetch
git fetch origin

# Pull
git pull origin main
```

### Repository Management

```bash
# List repositories in container
docker compose exec git-server ls -la /var/git/coopernetes/
docker compose exec git-server ls -la /var/git/finos/

# View repository config
docker compose exec git-server git -C /var/git/coopernetes/test-repo.git config -l

# Reset a repository (careful!)
docker compose exec git-server rm -rf /var/git/coopernetes/test-repo.git
docker compose restart git-server  # Will reinitialize
```

### MongoDB Operations

```bash
# Connect to MongoDB shell
docker compose exec mongodb mongosh gitproxy

# View collections
docker compose exec mongodb mongosh gitproxy --eval "db.getCollectionNames()"

# Clear database (careful!)
docker compose exec mongodb mongosh gitproxy --eval "db.dropDatabase()"
```

---

## File Reference

### Core Files

| File                     | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `Dockerfile`             | Defines the git-server container with Apache, git, and Python |
| `httpd.conf`             | Apache configuration for git HTTP backend and CGI             |
| `init-repos.sh`          | Creates test repositories on container startup                |
| `git-capture-wrapper.py` | CGI wrapper that captures git protocol data                   |
| `extract-captures.sh`    | Helper script to extract captures from container              |
| `extract-pack.py`        | Extracts PACK files from captured request data                |

### Generated Files

| File             | Description                                   |
| ---------------- | --------------------------------------------- |
| `*.request.bin`  | Raw HTTP request body (PACK files for pushes) |
| `*.response.bin` | Raw HTTP response (unpack status for pushes)  |
| `*.metadata.txt` | Human-readable capture metadata               |

---

## Use Cases Summary

### 1. Integration Testing

Run full end-to-end tests with real git operations against a local server.

### 2. Generate Test Fixtures

Capture real git operations to create binary test data for unit tests.

### 3. Debug PACK Parsing

Extract PACK files and compare your parser output with git's official tools.

### 4. Protocol Analysis

Study the git HTTP protocol by examining captured request/response data.

### 5. Regression Testing

Capture problematic operations for reproduction and regression testing.

### 6. Development Workflow

Develop GitProxy features without requiring external git services.

---

## Status

✅ **All systems operational and validated** (as of 2025-10-01)

- Docker containers build and run successfully
- Test repositories initialized with proper HEAD references
- Git clone, push, and pull operations work correctly
- Data capture system functioning properly
- PACK extraction and verification working
- Integration with Node.js test suite confirmed

---

## Additional Resources

- **Git HTTP Protocol**: https://git-scm.com/docs/http-protocol
- **Git Pack Format**: https://git-scm.com/docs/pack-format
- **Git Plumbing Commands**: https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain
- **GitProxy Documentation**: `../website/docs/`

---

**For questions or issues with this testing setup, please refer to the main project documentation or open an issue.**
