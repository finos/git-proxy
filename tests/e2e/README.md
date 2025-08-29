# E2E Tests for Git Proxy

This directory contains end-to-end tests for the Git Proxy service using Vitest and TypeScript.

## Overview

The e2e tests verify that the Git Proxy can successfully:

- Proxy git operations to backend repositories
- Handle repository fetching through HTTP
- Manage authentication appropriately
- Handle error cases gracefully

## Test Configuration

Tests use environment variables for configuration, allowing them to run against any Git Proxy instance:

| Environment Variable | Default                 | Description                           |
| -------------------- | ----------------------- | ------------------------------------- |
| `GIT_PROXY_URL`      | `http://localhost:8000` | URL of the Git Proxy server           |
| `GIT_PROXY_UI_URL`   | `http://localhost:8081` | URL of the Git Proxy UI               |
| `E2E_TIMEOUT`        | `30000`                 | Test timeout in milliseconds          |
| `E2E_MAX_RETRIES`    | `30`                    | Max retries for service readiness     |
| `E2E_RETRY_DELAY`    | `2000`                  | Delay between retries in milliseconds |

## Running Tests

### Local Development

1. Start the Git Proxy services (outside of the test):

   ```bash
   docker-compose up -d --build
   ```

2. Run the e2e tests:

   ```bash
   npm run test:e2e
   ```

### Against Remote Git Proxy

Set environment variables to point to a remote instance:

```bash
export GIT_PROXY_URL=https://your-git-proxy.example.com
export GIT_PROXY_UI_URL=https://your-git-proxy-ui.example.com
npm run test:e2e
```

### CI/CD

The GitHub Actions workflow (`.github/workflows/e2e.yml`) handles:

1. Starting Docker Compose services
2. Running the e2e tests with appropriate environment variables
3. Cleaning up resources

#### Automated Execution

The e2e tests run automatically on:

- Push to `main` branch
- Pull request creation and updates

#### On-Demand Execution via PR Comments

Maintainers can trigger e2e tests on any PR by commenting with specific commands:

| Comment     | Action                      |
| ----------- | --------------------------- |
| `/test e2e` | Run the full e2e test suite |
| `/run e2e`  | Run the full e2e test suite |
| `/e2e`      | Run the full e2e test suite |

**Requirements:**

- Only users with `write` permissions (maintainers/collaborators) can trigger tests
- The comment must be on a pull request (not on issues)
- Tests will run against the PR's branch code

**Example Usage:**

```
@maintainer: The authentication changes look good, but let's verify the git operations still work.
/test e2e
```

## Test Structure

- `setup.ts` - Common setup utilities and configuration
- `fetch.test.ts` - Tests for git repository fetching operations
- `push.test.ts` - Tests for git repository push operations and authorization checks

### Test Coverage

**Fetch Operations:**

- Clone repositories through the proxy
- Verify file contents and permissions
- Handle non-existent repositories gracefully

**Push Operations:**

- Clone, modify, commit, and push changes
- Verify git proxy authorization mechanisms
- Test proper blocking of unauthorized users
- Validate git proxy security messages

**Note:** The current test configuration expects push operations to be blocked for unauthorized users (like the test environment). This verifies that the git proxy security is working correctly. In a real environment with proper authentication, authorized users would be able to push successfully.

## Prerequisites

- Git Proxy service running and accessible
- Test repositories available (see `integration-test.config.json`)
- Git client installed for clone operations
