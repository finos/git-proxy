---
name: sink-parity
description: Keep the fs, mongo and postgres sink backends at feature parity when changing any of them
---

Keep the sink backends at feature parity.

Read `AGENTS.md` first. It is the canonical project guide for this repository.

GitProxy persists its state through interchangeable sink backends: `src/db/file` (NeDB), `src/db/mongo`, and `src/db/postgres`. They all implement the `Sink` interface in `src/db/types.ts`, and deployments pick one via the `sink` config. A feature that exists in one backend but not the others is a bug waiting for whichever deployment uses the others.

Use this skill whenever a change touches any of:

- the `Sink` interface or the entity classes (`Repo`, `User`, push types) in `src/db/types.ts`
- any backend adapter under `src/db/file`, `src/db/mongo`, or `src/db/postgres`
- the migration framework (`src/db/migrations`) or the postgres schema

## The contract

- `src/db/types.ts` is the single source of truth. A new `Sink` member or entity field is not done until all three backends implement it in the same change; do not leave a backend behind for a follow-up.
- `npm run check-types:server` enforces the interface structurally, but it cannot see semantic drift. The rest of this checklist exists for what the compiler cannot catch.

## Adding or changing a Sink member

1. Add the member to the `Sink` interface with a doc comment stating its semantics (ordering, case sensitivity, empty-result shape).
2. Implement it in `src/db/file`, `src/db/mongo`, and `src/db/postgres`. Use the mongo implementation as the reference for behaviour unless the doc comment says otherwise.
3. Export it from each backend's `index.ts` and wire the dispatcher in `src/db/index.ts`.
4. Add unit tests for every backend, not just the one you started from.

## Adding a field to an entity

1. Update the class in `src/db/types.ts`.
2. fs and mongo store documents whole, so writes usually pass new fields through automatically; verify reads return them.
3. postgres maps fields to columns explicitly, so every layer must be updated by hand:
   - schema: add the column (see the migration rules below)
   - create: insert the field, applying the same defaults as mongo (for example `dateCreated`/`lastModified` are stamped with the current ISO time on create)
   - update: extend the column allowlist; a field missing from the allowlist is dropped silently, and an update reduced to zero columns throws, which has already nearly shipped a startup crash (`populateRepoDates`)
   - read: add the column to every select and to the row-to-entity mapping
4. If mongo or fs bump `lastModified` (or similar) on a mutation, every backend must bump it on that mutation.

## Postgres schema changes

- Schema changes are append-only migrations; never edit or reorder an entry that has shipped.
- Cross-backend logical migrations belong in `src/db/migrations` (registered in `registry.ts`) and run through the `Sink` hooks (`getAppliedMigrations`, `recordMigration`, `unrecordMigration`), so they must work against all three backends.
- `deriveCreatedAt` is best-effort by design: mongo derives a timestamp from the ObjectId, fs and postgres return `undefined` and callers fall back. Do not assume it returns a value.

## Semantic parity rules

- Same defaults on create in every backend.
- Same case handling: usernames are lowercased on permission changes; name lookups are case-insensitive where mongo's are.
- Same projections: list endpoints must return the same field set from every backend, or UI behaviour diverges by deployment.
- Same error behaviour for invalid input (missing id, empty update).

## Verify before pushing

```
npm run check-types:server
cross-env NODE_ENV=test npx vitest --run test/db
npm run lint
npm run format:check
```

Postgres integration tests (`npm run test:integration:postgres`) need a reachable PostgreSQL database; CI runs them in the dedicated lane.
