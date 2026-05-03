# GitProxy Copilot Instructions

Read `AGENTS.md` for the full project guide. Use the rules below as the highest-priority summary for Copilot surfaces that truncate long instruction files.

- Preserve the GitProxy flow: Git HTTP proxy -> ordered action chain -> service API -> audit trail -> approval gate.
- A push must never reach the real remote unless it is explicitly approved or auto-approved by policy.
- Do not bypass `blockForAuth`, waiting-authorization checks, or audit logging.
- Keep proxy, service, config, and UI responsibilities separate. Do not place policy logic ad hoc in request handlers.
- The action chain is the core abstraction. Put reusable enforcement logic in processors, organization-specific logic in plugins, and UI/auth state changes in the service layer.
- Processor order matters. If logic depends on cloned repositories, diffs, or earlier artifacts, place it accordingly.
- Processors must be idempotent, use the `Action` object instead of shared mutable state, and preserve audit traceability.
- Configuration changes must update schema validation, keep backward-compatible defaults, and avoid weakening security by default.
- Authentication strategies apply to UI and approval workflows. Git push identity is derived from commit metadata, not interactive auth.
- When changing proxy/processors, test success paths, rejection paths, and audit logging. When changing config, test invalid values and defaults.
- Use the standard repo commands: `npm run build`, `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run format:check`.
