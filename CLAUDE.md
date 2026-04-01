# Claude Instructions

Read and follow `AGENTS.md` first. It is the canonical project guide for this repository.

Additional Claude-specific notes:

- Apply `AGENTS.md` as the source of truth. If this file and `AGENTS.md` ever differ, `AGENTS.md` wins.
- Keep changes aligned with the chain-of-processors architecture. Do not bypass approval gating, `blockForAuth`, waiting-authorization checks, or audit logging.
- Prefer the existing build, test, lint, and format commands listed in `AGENTS.md`.
- Project slash-command entry points live in `.claude/commands/` and delegate to the shared definitions in `.agents/commands/`.
- Treat `.claude/worktrees/` as local machine state. Do not rely on it or commit changes from it.
