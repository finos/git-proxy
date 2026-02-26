# Contributing to GitProxy

Thanks for your interest in contributing to GitProxy! This guide covers everything you need to get a local development environment running, understand the codebase, and submit high-quality pull requests.

For project governance, roles, and voting procedures, see the [Governance section on the website](https://git-proxy.finos.org).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
  - [Unit Tests](#unit-tests)
  - [End-to-End Tests](#end-to-end-tests)
  - [UI Tests (Cypress)](#ui-tests-cypress)
  - [Fuzz Tests](#fuzz-tests)
  - [Coverage Requirements](#coverage-requirements)
- [Code Quality](#code-quality)
- [Configuration Schema](#configuration-schema)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Community](#community)

## Prerequisites

| Tool                                                                                                       | Version                        | Notes                       |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------- |
| [Node.js](https://nodejs.org/en/download)                                                                  | 20.18.2+, 22.13.1+, or 24.0.0+ | Check with `node -v`        |
| [npm](https://npmjs.com/)                                                                                  | 8+                             | Bundled with Node.js        |
| [Git](https://git-scm.com/downloads)                                                                       | Any recent version             | Must support HTTP/S         |
| [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) | Any recent version             | Required for E2E tests only |

## Getting Started

### 1. Fork & clone

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/<your-username>/git-proxy.git
cd git-proxy
```

### 2. Install dependencies

```bash
npm install
```

This installs all dependencies for the server, UI, and CLI workspace packages. [Husky](https://typicode.github.io/husky/) git hooks are configured automatically via the `prepare` script.

### 3. Run the application

```bash
# Run both the proxy server and the dashboard UI (recommended for development)
npm start
```

This starts two processes concurrently:

| Process      | Command          | URL                                                             | Description                                 |
| ------------ | ---------------- | --------------------------------------------------------------- | ------------------------------------------- |
| Proxy server | `npm run server` | `http://localhost:8000` (proxy) / `http://localhost:8080` (API) | Express server handling git operations      |
| Dashboard UI | `npm run client` | `http://localhost:3000`                                         | Vite dev server with hot module replacement |

You can also run them independently:

```bash
npm run server  # Proxy server only
npm run client  # Vite UI dev server only
```

### 4. Verify it works

```bash
# Clone a repo through GitProxy
git clone http://localhost:8000/octocat/Hello-World.git
```

By default, GitProxy blocks all pushes. To allow pushes for a specific repo, add it to `proxy.config.json`. See the [Configuration docs](https://git-proxy.finos.org/docs/category/configuration) for details.

## Project Structure

```
git-proxy/
├── src/
│   ├── proxy/              # Core proxy logic (action chain, processors)
│   ├── service/            # Express app, API routes, authentication (Passport.js)
│   ├── db/                 # Database abstraction (MongoDB + NeDB)
│   ├── config/             # Configuration loading and generated types
│   ├── ui/                 # React dashboard (Material-UI)
│   ├── plugin.ts           # Plugin base classes (PushActionPlugin, PullActionPlugin)
│   └── types/              # Shared TypeScript types
├── test/                   # Unit and integration tests (Vitest)
├── tests/e2e/              # End-to-end tests (Vitest + Docker)
├── cypress/                # UI tests (Cypress)
├── localgit/               # Local git server for E2E testing (see localgit/README.md)
├── packages/
│   └── git-proxy-cli/      # CLI package
├── plugins/                # Sample plugin packages
├── website/                # Documentation site (Docusaurus)
├── index.ts                # CLI entry point
├── docker-compose.yml      # Docker Compose for E2E environment
├── proxy.config.json       # Default proxy configuration
├── config.schema.json      # JSON Schema for configuration
├── vite.config.ts          # Frontend build configuration
├── vitest.config.ts        # Unit test configuration
└── vitest.config.e2e.ts    # E2E test configuration
```

### Key architectural concepts

- **Action chain**: Git push/fetch requests flow through a chain of processors in `src/proxy/chain.ts`
- **Plugin system**: Extends the action chain with custom logic (see `src/plugin.ts`)
- **Dual database**: MongoDB for production state; [NeDB](https://github.com/seald/nedb) for local file-based development (`.data/` directory)
- **Authentication**: Passport.js strategies (local, Active Directory, OpenID Connect)

## Development Workflow

### Building

```bash
npm run build          # Full build: generate config types, build UI, compile TypeScript
npm run build-ts       # Compile TypeScript server code to dist/
npm run build-ui       # Build React frontend with Vite to build/
```

### Type checking

```bash
npm run check-types          # Type check everything (server + UI)
npm run check-types:server   # Type check server code only (faster)
```

### Git hooks

Husky runs the following hooks automatically:

- **pre-commit**: `lint-staged` runs Prettier on staged files
- **commit-msg**: `@commitlint/cli` enforces [Conventional Commits](https://www.conventionalcommits.org/) format

Commit message examples:

```
feat: add new OIDC authentication strategy
fix: resolve race condition in push processor
docs: update testing guide with Vitest examples
test: add fuzz tests for repo name validation
```

## Testing

GitProxy has three test suites, each serving a different purpose.

### Unit Tests

Unit and integration tests use [Vitest](https://vitest.dev/) and are located in the `test/` directory. These do **not** require Docker.

```bash
npm test               # Run all unit tests once
npm run test-watch     # Watch mode (re-runs on file changes)
npm run test-shuffle   # Randomized execution order (detects test coupling)
npm run test-coverage  # Run with coverage report
```

Configuration: [vitest.config.ts](vitest.config.ts)

Test files are organized by module:

```
test/
├── processors/        # Proxy processor logic
├── db/                # Database operations
├── services/          # API and service tests
├── integration/       # Cross-module integration tests
├── plugin/            # Plugin system tests
├── preReceive/        # Git hook tests
└── fixtures/          # Binary test data for protocol-level tests
```

### MongoDB Integration Tests

Some tests require a real MongoDB instance. These are guarded by the `RUN_MONGO_TESTS` environment variable and run separately from unit tests.

```bash
# Start MongoDB with Docker
docker run -d --name mongodb-test -p 27017:27017 mongo:7

# Run MongoDB integration tests
RUN_MONGO_TESTS=true npm run test:integration

# Cleanup
docker stop mongodb-test && docker rm mongodb-test
```

Configuration: [vitest.config.integration.ts](vitest.config.integration.ts)

In CI, `RUN_MONGO_TESTS` is set automatically in the workflow that runs integration tests.

### End-to-End Tests

E2E tests perform real git operations against a Dockerized environment. They use Vitest with a separate config.

**Prerequisites**: Docker and Docker Compose must be running.

```bash
# Run E2E tests (builds containers, runs tests, tears down)
npm run test:e2e

# Watch mode for E2E development
npm run test:e2e:watch
```

Configuration: [vitest.config.e2e.ts](vitest.config.e2e.ts)

#### Docker Compose environment

The E2E environment is defined in [docker-compose.yml](docker-compose.yml) and consists of three services:

| Service      | Port       | Description                                                               |
| ------------ | ---------- | ------------------------------------------------------------------------- |
| `git-proxy`  | 8000, 8081 | GitProxy application under test                                           |
| `mongodb`    | 27017      | MongoDB 7 instance                                                        |
| `git-server` | 8443       | Apache-based git HTTP server with test repos (see [localgit/](localgit/)) |

All services run in an isolated `git-network` Docker bridge network.

#### Managing the environment manually

When developing or debugging E2E tests, you'll often want to keep the containers running between test runs rather than letting the test script tear them down:

```bash
# Start all services in the background
docker compose up -d

# Verify all three containers are running
docker compose ps

# Rebuild from scratch (e.g., after changing localgit/ or Dockerfile)
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

#### Test repositories and credentials

The git server is initialized with two test repos:

| Repository                 | Path                                                    |
| -------------------------- | ------------------------------------------------------- |
| `test-owner/test-repo.git` | Simple test repo with a README and text file            |
| `e2e-org/sample-repo.git`  | Sample project with a README, package.json, and LICENSE |

Two users are pre-configured:

| Username   | Password   | Purpose                   |
| ---------- | ---------- | ------------------------- |
| `admin`    | `admin123` | Full access to all repos  |
| `testuser` | `user123`  | Standard user for testing |

#### Interacting with test repos

```bash
# Clone directly from the git server
git clone http://admin:admin123@localhost:8443/test-owner/test-repo.git

# Clone through GitProxy
git clone http://admin:admin123@localhost:8000/test-owner/test-repo.git

# Push a change
cd test-repo
echo "test" > test.txt
git add test.txt
git commit -m "test commit"
git push origin main
```

#### Viewing logs

```bash
docker compose logs -f git-proxy    # GitProxy application logs
docker compose logs -f git-server   # Apache git server logs
docker compose logs -f mongodb      # MongoDB logs
```

#### Troubleshooting

If services won't start or tests fail unexpectedly:

```bash
# Check service status
docker compose ps

# View logs for the failing service
docker compose logs git-server

# Nuclear option: tear down everything and rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

If MongoDB connections fail:

```bash
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

#### Generating test fixtures

The git server includes a data capture system that records raw git protocol data for every operation. This is useful for creating binary test fixtures (e.g., PACK files) for unit tests. See [localgit/README.md](localgit/README.md) for details on the capture system, PACK extraction tools, and fixture generation workflow.

### UI Tests (Cypress)

[Cypress](https://docs.cypress.io) tests exercise the dashboard UI end-to-end.

```bash
# Start the app first
npm start

# Then, in another terminal:
npm run cypress:open   # Interactive test runner (recommended for development)
npm run cypress:run    # Headless mode (used in CI)
```

Configuration: [cypress.config.js](cypress.config.js)

Cypress tests live in `cypress/e2e/` and use custom commands defined in `cypress/support/commands.js` (e.g., `cy.login(username, password)`).

### Fuzz Tests

Some test files include fuzz tests using [fast-check](https://fast-check.dev/) to find edge-case bugs with randomized inputs. These run as part of the regular unit test suite (`npm test`).

### Coverage Requirements

All new code introduced in a PR **must have over 80% patch coverage**. This is enforced by [CodeCov](https://app.codecov.io/gh/finos/git-proxy) in CI.

```bash
# Generate a local coverage report
npm run test-coverage
```

The coverage report is written to `./coverage/`. If your PR is below the threshold, check the CodeCov report on your PR for uncovered lines.

## Code Quality

```bash
npm run lint           # Run ESLint
npm run lint:fix       # ESLint with auto-fix
npm run format         # Format all files with Prettier
npm run format:check   # Check formatting without modifying files
```

CI runs ESLint, Prettier, and TypeScript type checks on every PR (see [`.github/workflows/lint.yml`](.github/workflows/lint.yml)).

## Configuration Schema

GitProxy uses a JSON Schema ([config.schema.json](config.schema.json)) to define and validate configuration. When adding or modifying config properties:

1. Update `config.schema.json` with the new/changed properties
2. Regenerate TypeScript types:
   ```bash
   npm run generate-config-types
   ```
3. Regenerate the schema reference documentation for the website:
   ```bash
   # Requires Python and json-schema-for-humans:
   # pip install json-schema-for-humans
   npm run gen-schema-doc
   ```

## Submitting a Pull Request

1. **Check for existing issues**: Search [open issues](https://github.com/finos/git-proxy/issues) before starting work. If none exists, [create one](https://github.com/finos/git-proxy/issues/new) describing the change.
2. **Fork & branch**: Create a feature branch from `main` (e.g., `feat/my-feature` or `fix/my-bugfix`).
3. **Make your changes**: Follow the code style enforced by ESLint and Prettier. Write tests for new functionality.
4. **Verify locally**:
   ```bash
   npm run check-types:server  # Type check
   npm test                    # Unit tests
   npm run lint                # Lint
   npm run format:check        # Formatting
   ```
5. **Commit using [Conventional Commits](https://www.conventionalcommits.org/)**: The commit-msg hook validates this automatically.
6. **Push & open a PR**: Target the `main` branch. Fill in the PR template and link the relevant issue.

### CI checks on your PR

The following checks must pass before a PR can be merged:

- **Unit tests**: Run across a matrix of Node.js (20, 22, 24) and MongoDB (6.0, 7.0, 8.0) versions on Ubuntu, plus a Windows build
- **E2E tests**: Docker-based end-to-end tests
- **Cypress tests**: UI end-to-end tests
- **Lint & format**: ESLint, Prettier, TypeScript type checks
- **Commit lint**: Conventional Commits validation
- **Coverage**: 80%+ patch coverage via CodeCov
- **Security**: CodeQL analysis, dependency review, OpenSSF Scorecard

### Contributor License Agreement (CLA)

All contributors must have a CLA on file with FINOS before PRs can be merged. Review the FINOS [contribution requirements](https://finosfoundation.atlassian.net/wiki/spaces/FINOS/pages/75530375/Contribution+Compliance+Requirements) and submit the required CLA.

## Community

- **Slack**: [#git-proxy](https://finos-lf.slack.com/archives/C06LXNW0W76) on the FINOS Slack workspace
- **Mailing list**: [git-proxy+subscribe@lists.finos.org](mailto:git-proxy+subscribe@lists.finos.org)
- **Community meetings**: Fortnightly on Mondays at 4PM BST (odd week numbers) via [Zoom](https://zoom-lfx.platform.linuxfoundation.org/meeting/95849833904?password=99413314-d03a-4b1c-b682-1ede2c399595). [Add to Google Calendar](https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=MTRvbzM0NG01dWNvNGc4OGJjNWphM2ZtaTZfMjAyNTA2MDJUMTUwMDAwWiBzYW0uaG9sbWVzQGNvbnRyb2wtcGxhbmUuaW8&tmsrc=sam.holmes%40control-plane.io&scp=ALL).
- **Issues**: [github.com/finos/git-proxy/issues](https://github.com/finos/git-proxy/issues)
