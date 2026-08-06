# GitProxy Contribution and Governance Policies

This document describes the contribution process and governance policies of the FINOS GitProxy project. The project is also governed by the [Linux Foundation Antitrust Policy](https://www.linuxfoundation.org/antitrust-policy/), and the FINOS [IP Policy](https://community.finos.org/assets/files/IP-Policy-fe5925025fc0a57b1cbed64f86b26a73.pdf), [Code of Conduct](https://www.finos.org/code-of-conduct), [Collaborative Principles](https://community.finos.org/docs/governance/collaborative-principles/), and [Meeting Procedures](https://community.finos.org/docs/governance/meeting-procedures/).

## Technical Charter

The project's [Technical Charter](CHARTER.md) defines its mission, scope, maintainer structure, intellectual property framework, and amendment process. Do not duplicate that material here.

## Contribution Process

Before making a contribution, please take the following steps:

1. Check whether there's already an [open issue](https://github.com/finos/git-proxy/issues) related to your proposed contribution. If there is, join the discussion and propose your contribution there.
1. If there isn't already a relevant issue, [create one](https://github.com/finos/git-proxy/issues/new), describing your contribution and the problem you're trying to solve.
1. Respond to any questions or suggestions raised in the issue by other developers.
1. Fork the project repository and prepare your proposed contribution.
1. Submit a pull request.

> **NOTE:** Contributors must meet FINOS contribution requirements (CLA). Please read the [FINOS Contribution Requirements](https://community.finos.org/docs/governance/Software-Projects/contribution) before opening pull requests.

## Governance

### Roles

The project community consists of Contributors and Maintainers:

- A **Contributor** is anyone who submits a contribution to the project. (Contributions may include code, issues, comments, documentation, media, or any combination of the above.)
- A **Maintainer** is a Contributor who, by virtue of their contribution history, has been given write access to project repositories and may merge approved contributions.
- The **Lead Maintainer** is the project's interface with the FINOS team and Board. They are responsible for approving quarterly project reports and communicating on behalf of the project. The Lead Maintainer is elected by a vote of the Maintainers.

### Contribution Rules

Anyone is welcome to submit a contribution to the project. The rules below apply to all contributions. (The key words "MUST", "SHALL", "SHOULD", "MAY", etc. in this document are to be interpreted as described in [IETF RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).)

- All contributions MUST be submitted as pull requests, including contributions by Maintainers.
- All pull requests MUST be reviewed by a Maintainer (other than the Contributor) before being merged.
- Pull requests for non-trivial contributions SHOULD remain open for a review period sufficient to give all Maintainers a reasonable opportunity to review and comment on them.
- After the review period, if no Maintainer has an objection to the pull request, any Maintainer MAY merge it.
- If any Maintainer objects to a pull request, the Maintainers SHOULD try to come to consensus through discussion. If consensus cannot be reached, any Maintainer MAY call for a vote on the contribution using the Maintainer Voting process below.

#### Cross-Firm Review

GitProxy is used as a risk control in regulated financial institutions. To ensure broad consensus among the firms involved in project maintenance, pull requests that introduce new features (corresponding to `feat:` conventional commits), breaking changes (corresponding to a major version bump), or other changes that a Maintainer judges to be significant MUST be approved by at least one Maintainer from a different organisation than the contributing author before being merged.

This requirement does NOT apply to:

- Bug fixes
- Documentation updates
- Dependency patches and vulnerability remediation
- CI/infrastructure maintenance
- Refactoring that does not change external behaviour
- Other routine upkeep

Maintainers contributing such changes are expected to abide by the spirit of this rule — i.e., seek cross-firm review proactively rather than requiring it to be enforced.

### Maintainer Voting

The Maintainers MAY hold votes only when they are unable to reach consensus on an issue. Any Maintainer MAY call a vote on a contested issue, after which Maintainers SHALL have 36 hours to register their votes. Votes SHALL take the form of "+1" (agree), "-1" (disagree), "+0" (abstain). Issues SHALL be decided by the majority of votes cast. If there is only one Maintainer, they SHALL decide any issue otherwise requiring a Maintainer vote. If a vote is tied, FINOS (via [help@finos.org](mailto:help@finos.org)) SHALL cast the deciding vote.

The Maintainers SHALL decide the following matters by consensus or, if necessary, a vote:

- Contested pull requests
- Election and removal of the Lead Maintainer
- Election and removal of Maintainers

All Maintainer votes MUST be carried out transparently, with all discussion and voting occurring in public, either:

- in comments associated with the relevant issue or pull request, if applicable;
- on the project mailing list or other official public communication channel; or
- during a regular, minuted community meeting.

### Dispute Resolution

If a contribution or project decision is contested, the following escalation process applies:

1. Discussion in the relevant PR or issue thread to seek consensus among Maintainers.
1. If unresolved, raise the matter at the next community meeting for open discussion.
1. If still unresolved, any Maintainer MAY call a vote (36-hour window, majority decides per the Maintainer Voting process above).
1. If the vote is tied, FINOS (via [help@finos.org](mailto:help@finos.org)) SHALL cast the deciding vote.

A contributor whose pull request is closed may address the concerns raised and re-submit. If a contributor believes their contribution was unfairly rejected, they may invoke the dispute resolution process above.

### Maintainer Qualifications

Any Contributor who has made a substantial contribution to the project MAY apply (or be nominated) to become a Maintainer. The existing Maintainers SHALL decide whether to approve the nomination according to the Maintainer Voting process above.

### Maintainer List

The current Maintainer roster is recorded in [`MAINTAINERS.md`](MAINTAINERS.md). All changes to the maintainer list are managed publicly:

- Any addition, removal, or update MUST be submitted as a pull request to `MAINTAINERS.md`.
- If the change requires a Maintainer vote (e.g. election or removal of a Maintainer or the Lead Maintainer), the vote outcome MUST be documented in, or linked from, the pull request description or comments.
- This process creates a public audit trail of project leadership over time.

Whenever `MAINTAINERS.md` is updated with a change to maintainership, please email [help@finos.org](mailto:help@finos.org).

### Changes to this Document

This document MAY be amended by a vote of the Maintainers according to the Maintainer Voting process above.

## Contributor License Agreement (CLA)

All contributors must have a CLA on file with FINOS before PRs can be merged. Review the FINOS [contribution requirements](https://community.finos.org/docs/governance/Software-Projects/contribution) and submit (or have your employer submit) the required CLA via [EasyCLA](https://community.finos.org/docs/governance/Software-Projects/easycla).

---

# Development Guide

Thanks for your interest in contributing to GitProxy! This section covers everything you need to get a local development environment running, understand the codebase, and submit high-quality pull requests.

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

We actively support and test against the latest two LTS Node versions, currently 22 and 24. When a new LTS version rolls out (26, 28, etc.), we deprecate the oldest one.

| Tool                                                                                                       | Version              | Notes                       |
| ---------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------- |
| [Node.js](https://nodejs.org/en/download)                                                                  | 22.13.1+, or 24.0.0+ | Check with `node -v`        |
| [npm](https://npmjs.com/)                                                                                  | 8+                   | Bundled with Node.js        |
| [Git](https://git-scm.com/downloads)                                                                       | Any recent version   | Must support HTTP/S         |
| [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) | Any recent version   | Required for E2E tests only |

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

### Release and Branching Process

To understand when your contribution will get merged upstream and published to NPM, see our [Releases guide](https://git-proxy.finos.org/docs/development/releases).

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

- **Unit tests**: Run across a matrix of the latest 2 Node.js (22, 24) and MongoDB (6.0, 7.0, 8.0) versions on Ubuntu, plus a Windows build
- **E2E tests**: Docker-based end-to-end tests
- **Cypress tests**: UI end-to-end tests
- **Lint & format**: ESLint, Prettier, TypeScript type checks
- **Commit lint**: Conventional Commits validation
- **Coverage**: 80%+ patch coverage via CodeCov
- **Security**: CodeQL analysis, dependency review, OpenSSF Scorecard

### Contributor License Agreement (CLA)

See the [CLA section](#contributor-license-agreement-cla) in the Governance section above.

## Community

- **Slack**: [#git-proxy](https://finos-lf.slack.com/archives/C06LXNW0W76) on the FINOS Slack workspace
- **Mailing list**: [git-proxy+subscribe@lists.finos.org](mailto:git-proxy+subscribe@lists.finos.org)
- **Community meetings**: Fortnightly on Mondays at 4PM BST (odd week numbers) via [Zoom](https://zoom-lfx.platform.linuxfoundation.org/meeting/95849833904?password=99413314-d03a-4b1c-b682-1ede2c399595). [Add to Google Calendar](https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=MTRvbzM0NG01dWNvNGc4OGJjNWphM2ZtaTZfMjAyNTA2MDJUMTUwMDAwWiBzYW0uaG9sbWVzQGNvbnRyb2wtcGxhbmUuaW8&tmsrc=sam.holmes%40control-plane.io&scp=ALL).
- **Issues**: [github.com/finos/git-proxy/issues](https://github.com/finos/git-proxy/issues)
