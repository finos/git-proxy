# CLAUDE.md — GitProxy

## Project Overview

GitProxy is a Git HTTP proxy that intercepts Git operations (primarily `git push`) and enforces organizational policies before allowing changes to reach the actual Git host.

It acts as:

- A **policy enforcement engine** (via processors and plugins)
- A **review/approval gate** (manual or automated)
- A **proxy server** for Git operations
- A **UI + API layer** for reviewing, approving, and auditing pushes

The core design principle is a **chain-of-processors architecture** where each Git action flows through ordered processing steps.

---

## Build & Run

```
# Build
npm run build

# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Lint check/fix
npm run lint
npm run lint:fix

# Format check/fix
npm run format:check
npm run format
```

**Stack: **

---

## High-Level Architecture

GitProxy consists of four main components:

```
Contributor (git push)
   ↓
HTTP Proxy (/src/proxy)
   ↓
Action Chain (Processors + Plugins)
   ↓
Service API (/src/service)
   ↓
Database (audit, users, repos, approvals)
   ↓
Web UI (/src/ui)
```

### 1. Proxy Server (`/src/proxy`)

Express-based HTTP proxy that:

- Intercepts Git operations
- Parses requests into an `Action`
- Executes the appropriate **Action Chain**
- Blocks, rejects, or queues for approval

Core concepts:

- **Action** — Represents a Git operation (push/pull/default)
- **Chain** — Ordered list of processors
- **Processor (Step)** — A single policy enforcement unit
- **Plugin** — Custom processor injected externally

---

### 2. Service API (`/src/service`)

Express application responsible for:

- UI communication
- Authentication (Passport strategies)
- Database access
- Approval/rejection workflows

Default port: `8080`

Authentication strategies supported:

- Local
- ActiveDirectory
- OpenID Connect

---

### 3. Configuration (`/src/config`)

Loads and validates `proxy.config.json`.

Controls:

- Authentication methods
- Repository allowlist
- Commit message policies
- Database configuration
- Feature flags

Schema reference:
[https://git-proxy.finos.org/docs/configuration/reference/](https://git-proxy.finos.org/docs/configuration/reference/)

---

### 4. Web UI (`/src/ui`)

React-based UI used to:

- View pending pushes
- Review diffs
- Approve/reject pushes
- Manage repositories/users (depending on role)

---

## Core Architectural Model

### Action Lifecycle (Push)

1. `parseAction` classifies request
2. `pushActionChain` executes processors in strict order
3. If blocked → rejected
4. If valid → queued for approval
5. Approver reviews in UI
6. If approved → user re-pushes to actual remote

---

### Action Chains

#### Push Action Chain

```
parsePush
checkEmptyBranch
checkRepoInAuthorisedList
checkCommitMessages
checkAuthorEmails
checkUserPushPermission
pullRemote
writePack
checkHiddenCommits
checkIfWaitingAuth
preReceive
getDiff
gitleaks
scanDiff
blockForAuth
```

**Order matters.** Some processors depend on artifacts created by previous ones (e.g., cloned repo, computed diff).

---

#### Pull Action Chain

```
checkRepoInAuthorisedList
```

---

#### Default Action Chain

```
checkRepoInAuthorisedList
```

---

### Processor Rules

When modifying or adding processors:

- They must be **idempotent**
- They must clearly define:
  - Required inputs
  - Side effects
  - Failure mode (reject vs throw vs auto-approve)

- They must not mutate shared state outside the `Action`
- They must preserve audit traceability

If a processor requires data not available at the end of the chain, it must be inserted earlier.

---

### Plugin System

Plugins:

- Extend push/pull chains
- Are externally defined processors
- Should not modify core system invariants
- Must respect chain ordering semantics

If logic needs access to internal chain data before plugins execute, implement a **custom processor**, not a plugin.

---

## Authentication Model

Authentication applies to:

- UI access
- Approval workflow
- User management

It does NOT authenticate Git pushes via the proxy itself — Git identity is derived from commit metadata (`user.email`).

Supported methods:

- Local (default)
- ActiveDirectory
- OpenID Connect

New strategies must:

1. Extend `/src/service/passport`
2. Provide a `configure()` function
3. Match config `type`
4. Be added to `authStrategies` in `index.ts`

---

## Audit Model

After chain execution:

- `audit` stores:
  - Action metadata
  - Processor results
  - Approval state

If repository clone occurred:

- `clearBareClone` must clean up disk artifacts

Never introduce processor changes that bypass audit logging.

Audit integrity is critical.

---

## Development Guidelines for Agents

### 1. Respect the Chain Architecture

The action chain is the core abstraction.

When implementing new functionality:

- Decide whether it belongs in:
  - Existing processor
  - New processor
  - Plugin
  - Service layer
  - UI

- Do NOT insert logic randomly in the proxy request handler.

---

### 2. Separation of Concerns

- Proxy handles Git interception + chain execution
- Service handles authentication + state
- Config handles validation and schema
- UI handles display + approval user flow

Do not mix responsibilities across modules.

---

### 3. Approval Semantics

Important rule:

> A push must never reach the real Git remote unless explicitly approved or auto-approved by policy.

Changes must not bypass:

- `blockForAuth`
- Approval state checks
- Waiting authorization checks

---

### 4. Configuration Safety

When introducing new config options:

- Add schema validation
- Provide sensible defaults
- Ensure backward compatibility
- Document in schema reference

Never silently change default security behavior.

---

### 5. Adding New Policies

#### If simple and configurable:

Add to existing processor (if cohesive).

#### If complex and reusable:

Create a new processor.

#### If organization-specific:

Implement as plugin.

Ask:

- Does this require diff access?
- Does this require cloned repo?
- Does this require user database?
- Does this need to run before approval gating?

---

### Testing Expectations

When modifying:

#### Proxy / Processors

- Must test:
  - Success path
  - Rejection path
  - Audit logging (`step.error`, `step.log`)

#### Config

- Must test:
  - Invalid values
  - Default values

---

## Common Pitfalls

- Breaking processor order dependencies
- Mixing UI and service logic
- Introducing security regressions in approval flow
- Mutating global/shared state outside `Action`

---

## License Header

All source files must include the Apache 2.0 license header (see any existing file).

---

## Agent Workflow

**The main agent must act as an orchestrator.** Never do work inline that can be delegated to a subagent.

- **Delegate everything:** Use the Task tool with specialized subagents for all research, code exploration, code writing, testing, and analysis. The main agent should plan, coordinate, and summarize — not do the work itself.
- **Maximize parallelism:** Launch multiple subagents concurrently whenever their tasks are independent. For example, when exploring code patterns AND analyzing tests AND checking dependencies, spawn all three agents in a single message rather than sequentially. Always send independent Task calls in a **single message** with multiple tool-use blocks.
<!-- - **Use the right agent type:** Pick `Explore` for codebase search/understanding, `Plan` for architecture decisions, `Bash` for commands, and specialized agents (e.g., `code-reviewer`, `test-automator`, `debugger`) when they match the task.
- **Keep the main context clean:** Offload large file reads, multi-file searches, and deep analysis to subagents so the main conversation stays focused on coordination and user communication.
- **Hooks run automatically — use subagents to respond:** When a hook (Spotless, build verification, code review, or simplification) reports an issue, delegate the fix to a subagent rather than doing it inline. If multiple hooks fail simultaneously, spawn parallel subagents to address each issue concurrently. -->

---

## Summary

GitProxy is:

- A deterministic policy pipeline
- Wrapped in a Git HTTP proxy
- With an approval gate
- Backed by a service API
- Audited end-to-end

All changes must respect that flow.
