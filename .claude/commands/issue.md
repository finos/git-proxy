Create a GitHub issue markdown file from the details provided by the user.

The user will describe a bug, feature request, or discussion context (e.g. Slack conversations, error logs, reproduction steps). Your job is to turn that into a well-structured issue and save it to `plans/`.

Steps:

1. Read the user's input to understand the problem, who reported it, and any logs or reproduction steps provided
2. Investigate the codebase to identify relevant code paths, pinpoint where the issue likely originates, and gather context that would help a contributor understand the problem
3. Write a concise GitHub issue markdown file and save it to `plans/issue-<short-slug>.md`

Issue format:

- Start with `## <title>` as the first line (this becomes the GitHub issue title)
- `### Problem` — 2-3 sentences explaining the issue and its impact
- `### Steps to Reproduce` — numbered list (if applicable)
- `### Expected Behavior` — 1-2 sentences
- `### Actual Behavior` — include relevant log snippets in code blocks, keep them short (trim stack traces to the key lines)
- `### Potential Root Cause` — based on your codebase investigation, explain where the issue likely lives. Link to source code using upstream GitHub URLs: `https://github.com/finos/git-proxy/blob/main/...#L<start>-L<end>`.
- `### Affected Files` — table with file links and one-line role descriptions
- `### Additional Context` — bullet points for version info, related code paths, or anything else useful

Style rules:

- Keep it concise — the whole issue should be under 80 lines
- Use code blocks sparingly — only for key log lines and small code snippets
- Do not propose fixes or implementation approaches
- Do not add Labels, Description, or Title as separate sections — the `##` heading is the title
- Write for a contributor who knows the project but hasn't seen this specific bug
- No emojis

$ARGUMENTS
