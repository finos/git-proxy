Update existing project documentation to reflect the current state of the branch.

Steps:

1. Run `git diff main...HEAD --stat` and `git log main..HEAD --oneline` to understand what changed on this branch
2. Read the changed files to understand what was added, removed, or modified
3. Read the current documentation files: `README.md`, `docs/Architecture.md`, `CLAUDE.md`
4. Identify documentation that is now outdated or missing based on the branch changes
5. Apply minimal, targeted edits to bring docs in line with the code

What to update:

- **Architecture.md** — new push actions, configuration parameters, plugins, build steps, authentiction methods
- **README.md** — project description, features list, usage examples
- **CLAUDE.md** — project structure, architecture, key modules, common pitfalls, build commands

Principles:

- **Minimal changes only.** Do not rewrite sections that are already accurate. Edit the smallest possible region.
- **Capture important information.** New commands, config keys, classes, architecture changes, and breaking changes must be documented.
- **Keep it concise.** Prefer inline descriptions over new subsections. Use tables and bullet points. Avoid verbose prose.
- **Match existing style.** Follow the formatting, tone, and structure already in each file. Do not add headings, sections, or patterns that don't already exist.
- **One edit per concern.** If a section needs updating, make one focused edit rather than rewriting the whole section.
- **Skip trivial changes.** Internal refactors, renames, or implementation details that don't affect the public interface do not need doc updates.

After editing, report what was updated:

- List each file edited and a one-line description of the change
- If no docs needed updating, say "Documentation is up to date" and stop

Do NOT:

- Create new documentation files
- Add sections or headings that don't already exist
- Rewrite large blocks of text when a small edit suffices
- Document internal implementation details
- Add emojis, badges, or decorative elements
- Update docs for changes that don't affect user-facing behavior
