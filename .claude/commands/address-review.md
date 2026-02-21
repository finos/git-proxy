Address review comments on a GitHub pull request.

The argument is a PR number (e.g. `/address-review 98`). If no number is given, ask the user.

## Phase 1: Fetch and display comments

1. Save the current branch name: `git rev-parse --abbrev-ref HEAD`
2. Checkout the PR branch: `gh pr checkout <number> --detach`
3. Fetch all review comments:

```
gh api repos/{owner}/{repo}/pulls/<number>/comments --paginate
```

4. Group comments by file. For each comment, extract: `id`, `path`, `line` (or `original_line`), `body`, `user.login`, `in_reply_to_id` (to detect threads).
5. Filter out threads that are already resolved or where the last message is from the PR author (likely already addressed).
6. Present a numbered summary to the programmer:

```
PR #<number> — <n> unaddressed review comments

 1. <file>:<line> — @<author>: <first 80 chars of comment>
 2. <file>:<line> — @<author>: <first 80 chars of comment>
 ...
```

If there are no unaddressed comments, say so and return to the original branch.

## Phase 2: Walk through each comment

For each comment in order, show:

- The full comment body
- The file path and line number
- The relevant code context (read ~10 lines around the commented line from the actual file)
- The author who left the comment

Then ask the programmer what to do using AskUserQuestion with these options:

- **Fix** — Make a code change to address the comment. After the programmer picks this, analyze the comment and the surrounding code, propose a fix, and apply it with Edit. Show the programmer what changed and confirm before moving to the next comment.
- **Reply** — Draft a reply to the comment. Write a concise, human-sounding response (see tone rules below). Show the exact text to the programmer. They can modify it. Queue the reply for posting in Phase 3.
- **Skip** — Move to the next comment without action.

If the programmer chooses Fix, apply the change and move on. If they choose Reply, queue it. Track all code changes and queued replies separately.

## Phase 3: Commit, push, and post replies

After walking through all comments:

**Code changes:**
If any code fixes were made, run the /commit skill to create a commit with the changes, then push:

```
git push
```

**Replies:**
If there are queued replies, show all of them in a final summary:

```
Queued replies:

1. <file>:<line> — reply to @<author>:
   "<reply text>"

2. <file>:<line> — reply to @<author>:
   "<reply text>"
```

Ask the programmer for final confirmation before posting. They can modify any reply text at this point.

Post each reply as a separate API call:

```
gh api repos/{owner}/{repo}/pulls/<number>/comments/<comment_id>/replies \
  --method POST \
  -f body="<reply text>"
```

After all replies are posted, return to the original branch:

```
git checkout <original-branch>
```

## Reply tone and style

Follow these rules strictly when drafting replies:

- Write as a human developer, not an AI. Never mention AI, automation, or tools.
- No markdown headings (#, ##, ###) in replies. Plain text and inline formatting only.
- Keep replies concise — 1-3 sentences. Get to the point.
- Conversational, collaborative tone: "good catch, fixed in the latest push", "I think this is fine because...", "yeah, updated this to use X instead"
- Be direct but not dismissive. If you disagree with a comment, explain briefly why.
- No bullet lists. Keep it flowing as natural text.
- No emojis.
- The programmer gets final say on every reply before it is posted.

## Rules

- Never post anything to GitHub without explicit programmer confirmation
- Never modify code without programmer approval
- Show exact reply text before queuing it
- The programmer can modify any reply at any point
- Always checkout with `--detach` to avoid creating local branches
- After everything is done, return to the original branch
- No emojis in any output
- No markdown headings in any output or posted content
- If an API call fails, show the error and ask the programmer how to proceed

$ARGUMENTS
