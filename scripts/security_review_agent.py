import os
import json
import litellm
from github import Github, Auth

# Setup

gh = Github(auth=Auth.Token(os.environ["GITHUB_TOKEN"]))
repo = gh.get_repo(os.environ["REPO_NAME"])
pr = repo.get_pull(int(os.environ["PR_NUMBER"]))

MODEL = os.environ["MODEL"]
for env_var in ["GITHUB_TOKEN", "REPO_NAME", "PR_NUMBER", "MODEL"]:
    if not os.environ[env_var]:
        raise ValueError(f"{env_var} is not set")

valid_api_keys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]
if not any(os.environ.get(api_key) for api_key in valid_api_keys):
    raise ValueError("No API key is set")


# Exclude files that are not useful for security analysis
IGNORED_FILENAMES = {
    "package-lock.json",
    "yarn.lock",
    "poetry.lock",
    "Gemfile.lock",
    "Cargo.lock",
    "composer.lock",
    "pnpm-lock.yaml",
    "pip.lock",
}

IGNORED_EXTENSIONS = {".lock", ".sum"}

# Truncate very large diffs like generated files to prevent bloating the prompt
MAX_PATCH_CHARS_PER_FILE = 3000

# System prompt

SYSTEM_PROMPT = """You are a security analysis assistant for a GitHub repository.
You are given the diff of a pull request and must identify potential security issues.

Focus only on security-relevant concerns such as:
- Hardcoded secrets, tokens, passwords or API keys
- Injection vulnerabilities (SQL, shell, template, etc.)
- Insecure use of cryptography or hashing
- Unsafe deserialization
- Path traversal or directory traversal risks
- Insecure direct object references
- Missing input validation or sanitisation on user-controlled data
- Use of known-vulnerable dependency versions (if visible in the diff)
- Overly permissive file or network access

Do NOT comment on code style, performance, test coverage, or general best practices
unless they have a direct security implication.

If you find no issues, say so clearly and briefly — do not invent concerns.
Format your response as a markdown comment suitable for posting directly on a GitHub PR.
Start with a short summary line, then list findings with file references where applicable.
If there are no findings, keep the response to 2-3 sentences maximum."""

# GitHub helpers

def get_pr_diff() -> str:
    """
    Fetches changed files and their patches, filtering out lockfiles and
    other noise. Returns a formatted string ready to be included in the prompt.
    """
    sections = []
    for f in pr.get_files():
        filename = os.path.basename(f.filename)
        _, ext = os.path.splitext(filename)

        if filename in IGNORED_FILENAMES or ext in IGNORED_EXTENSIONS:
            print(f"[diff] Skipping {f.filename} (ignored file type)")
            continue

        if not f.patch:
            print(f"[diff] Skipping {f.filename} (no patch — binary or too large)")
            continue

        patch = f.patch[:MAX_PATCH_CHARS_PER_FILE]
        truncated = len(f.patch) > MAX_PATCH_CHARS_PER_FILE
        sections.append(
            f"### {f.filename}\n```diff\n{patch}"
            + ("\n... (truncated)" if truncated else "")
            + "\n```"
        )

    return "\n\n".join(sections) if sections else "(no reviewable changes found)"


def find_previous_security_comment() -> object | None:
    """
    Looks for an existing security review comment posted by github-actions[bot]
    so we can replace it rather than stacking multiple comments on updated reviews.
    """
    for comment in pr.get_issue_comments():
        if (
            comment.user.login == "github-actions[bot]"
            and "🔒 Automated Security Review" in comment.body
        ):
            return comment
    return None


def post_or_update_comment(body: str):
    """
    If a previous security review comment exists, edit it in place.
    Otherwise post a new one to keep the PR timeline clean.
    """
    existing = find_previous_security_comment()
    if existing:
        existing.edit(body)
        print("[comment] Updated existing security review comment.")
    else:
        pr.create_issue_comment(body)
        print("[comment] Posted new security review comment.")

# Tools

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "post_security_review",
            "description": (
                "Post the security review findings as a comment on the PR. "
                "Call this once when your analysis is complete. "
                "If there are no findings, still call this to confirm the review ran."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "body": {
                        "type": "string",
                        "description": "The full markdown comment body to post on the PR.",
                    }
                },
                "required": ["body"],
            },
        },
    }
]

# Tool dispatch

def handle_tool_call(name: str, inputs: dict) -> str:
    if name == "post_security_review":
        # Prepend a header to identify review comments across runs
        body = f"## 🔒 Automated Security Review\n\n{inputs['body']}"
        post_or_update_comment(body)
        return "Security review comment posted."
    return f"Unknown tool: {name}"

# Agentic loop

def build_initial_message() -> str:
    trigger = os.environ.get("TRIGGER", "pull_request")
    trigger_note = (
        "This review was requested manually via `/security-review`."
        if trigger == "issue_comment"
        else "This review was triggered automatically on PR creation."
    )

    return (
        f"Please perform a security review of this pull request.\n\n"
        f"**PR #{pr.number}:** {pr.title}\n"
        f"_{trigger_note}_\n\n"
        f"---\n\n"
        f"{get_pr_diff()}"
    )


def run_security_review_agent():
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_initial_message()},
    ]

    while True:
        response = litellm.completion(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
        )

        message = response.choices[0].message

        if message.content:
            print(f"[agent] {message.content}")

        messages.append(message.model_dump(exclude_none=True))

        if response.choices[0].finish_reason == "stop" or not message.tool_calls:
            break

        tool_results = []
        for tool_call in message.tool_calls:
            inputs = json.loads(tool_call.function.arguments)
            result = handle_tool_call(tool_call.function.name, inputs)
            print(f"[tool] {tool_call.function.name}: {result}")
            tool_results.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

        messages.extend(tool_results)


if __name__ == "__main__":
    run_security_review_agent()
