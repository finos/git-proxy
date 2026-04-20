---
name: lint
description: Check and fix code formatting using ESLint and Prettier
---

Check and fix code formatting using ESLint and Prettier.

Read `AGENTS.md` first. It is the canonical project guide for this repository.

Steps:

1. Run `npm run format:check` to see if there are formatting violations
2. If violations are found, run `npm run format` to auto-fix them
3. Run `npm run lint` to see if there are linting errors
4. If errors are found, run `npm run lint:fix` to auto-fix them
5. After applying, run `git diff --stat` to show what files were reformatted
6. Summarize the changes (which files, what kind of formatting was fixed)

If no violations are found, say so and stop.

Do NOT commit the formatting changes — just apply and report.
