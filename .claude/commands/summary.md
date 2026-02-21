Generate a concise implementation summary for a PR description.

Steps:

1. First, run the `/docs` command to ensure documentation is up to date with the branch changes
2. Run `git diff master...HEAD --stat` and `git log master..HEAD --oneline` to understand all changes on this branch
3. Read the changed files to understand what was implemented and why
4. Get the current branch name: `git rev-parse --abbrev-ref HEAD`
5. Write a summary suitable for a GitHub PR description
6. Save the raw markdown summary (without the wrapping code fence) to `plans/<branch-name>-summary.md`, replacing any `/` in the branch name with `-`

Summary format rules:

- The summary must be GitHub-flavored markdown that renders nicely in a PR description
- Do NOT use any headings (`#`, `##`, `###`, etc.) — structure the summary with bold labels and line breaks instead
- Use `**bold**` for section labels (e.g., `**What:**`, `**Why:**`, `**Changes:**`)
- Use backtick-wrapped inline code for file names, config keys, commands, and identifiers
- Use markdown bullet points (`-`) for listing changes
- Use numbered lists for verification steps
- Use `[text](url)` for hyperlinks when referencing issues or external resources
- Start with `**What:**` — a one-line statement explaining the change
- Follow with `**Why:**` — 2-3 sentences max explaining the motivation
- Include `**Changes:**` — key changes as bullet points (no nested bullets)
- If there are new tests, add `**Tests:**` with one line describing coverage
- End with `**How to verify:**` — concrete steps as a numbered list
- Keep the total summary under 30 lines
- Do not repeat file paths or class names unnecessarily
- Focus on behavior changes, not implementation details
- Write in present tense, active voice

Output rules:

- Do NOT print the summary to the conversation
- Only save it to the file and tell the user where it was saved: "Summary saved to `plans/<branch-name>-summary.md`"

Do NOT:

- Use headings (`#`, `##`, `###`) anywhere in the summary
- Use tables or badges
- List every single file changed
- Include generic boilerplate like "This PR adds..."
- Add emojis
- Over-explain things that are obvious from the diff
- Print the summary content in the conversation output
