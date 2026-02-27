Create a git commit for the current staged/unstaged changes using Conventional Commits.

Rules:

1. Run `git status` and `git diff` to understand what changed
2. Stage relevant files (prefer specific files over `git add -A`)
3. Write a commit message following Conventional Commits format
4. Use `--signoff` to sign off using the committer's git config (do NOT hardcode any name/email)
5. Do NOT add Co-Authored-By or any other trailers beyond Signed-off-by
6. If there are no changes, say so and stop

Commit format:

```
<type>[optional scope]: <description>
```

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore

Scope (optional): a noun describing the affected area in parentheses.
Common scopes: config, api, proxy, db, e2e, docker, ci.

Subject line rules:

- Imperative mood ("add", not "added" or "adds")
- Do NOT capitalize the first letter after the type prefix
- Do NOT end with a period
- Keep under 72 characters total

For breaking changes, add `!` after the type/scope:

```
feat(config)!: rename queue config key
```

Examples of good messages:

- "feat(api): add support for rejection reason"
- "fix(config): handle invalid regex on commitConfig"
- "refactor(ts): remove any/as usages in push-actions"
- "test(proxy): add tests for Git hosts other than GitHub"
- "docs: update architecture diagram in Architecture.md"
- "build: bump express to 5.2.1"
- "chore: remove unused import in services/push.ts"

Commit command:

```
git commit --signoff -m "<type>[scope]: <description>"
```

Do NOT:

- Use long multi-line messages for simple changes
- Add Co-Authored-By trailers
- Use past tense ("added", "fixed")
- Hardcode any author name or email
- Omit the type prefix
