import os
from github import Github, Auth
from helpers import validate_env_vars, validate_api_keys, run_agent

# Setup

gh = Github(auth=Auth.Token(os.environ["GITHUB_TOKEN"]))
repo = gh.get_repo(os.environ["REPO_NAME"])
pr = repo.get_pull(int(os.environ["PR_NUMBER"]))
author = os.environ["AUTHOR_USERNAME"]

MODEL = os.environ["MODEL"]
validate_env_vars(["GITHUB_TOKEN", "REPO_NAME", "PR_NUMBER", "AUTHOR_USERNAME", "MODEL"])
validate_api_keys()

# Tools

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "post_comment",
            "description": (
                "Post a comment on the PR. Use this to welcome a first-time contributor, "
                "ask for a clearer description, request an issue link, or flag non-compliance "
                "with CONTRIBUTING.md. Combine multiple concerns into a single comment where "
                "possible rather than posting several separate ones."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "body": {"type": "string", "description": "The comment text (markdown supported)."}
                },
                "required": ["body"],
            },
        },
    },
]

# System prompt

SYSTEM_PROMPT = """You are a PR review assistant for an open-source GitHub repository.
Check the following in order, then post at most one comment combining all concerns. If nothing needs flagging, stay silent.

Checks:
1. FIRST CONTRIBUTION: Welcome first-time contributors and link any getting-started resources from CONTRIBUTING.md.
2. DESCRIPTION: If missing or too vague to explain what changed and why, ask for clarification.
3. LINKED ISSUE: If no "Fixes/Closes/Resolves/Related to #N" link exists, ask the author to add one.
4. CONTRIBUTING.md: If the PR doesn't follow the required structure, quote the specific rule that is violated.

Rules:
- One comment maximum. Combine all concerns.
- Silence if everything is fine.
- Be constructive, not demanding.
- No emojis.

When posting a comment, always use this exact structure (omit sections that don't apply):

Thanks for the contribution!

<what is unclear and what to add>

<ask to link or create an issue>

<quote rule from CONTRIBUTING.md, then explain what needs to change>
... (repeat for each rule that is violated)"""

# GitHub helpers

def get_contributing_md() -> str:
    """Fetches CONTRIBUTING.md from the repo root, or returns a notice if absent."""
    try:
        contents = repo.get_contents("CONTRIBUTING.md")
        return contents.decoded_content.decode("utf-8")
    except Exception:
        return "(No CONTRIBUTING.md found in this repository.)"


def is_first_contribution() -> bool:
    """Returns True if the author has no previously merged PRs in this repo."""
    first_contribution_list = ['FIRST_TIMER', 'FIRST_TIME_CONTRIBUTOR', 'NONE']
    return os.environ["AUTHOR_ASSOCIATION"] in first_contribution_list


def post_comment(body: str) -> str:
    pr.create_issue_comment(body)
    return "Comment posted."

# Tool dispatch

def handle_tool_call(name: str, inputs: dict) -> str:
    if name == "post_comment":
        result = post_comment(inputs["body"])
    else:
        result = f"Unknown tool: {name}"

    print(f"[tool] {name}: {result}")
    return result

# Agentic loop

def build_initial_message() -> str:
    first_contribution = is_first_contribution()
    contributing_md = get_contributing_md()

    return (
        f"Please review this newly opened PR:\n\n"
        f"Title: {os.environ['PR_TITLE']}\n"
        f"Author: {author} ({'first-time contributor' if first_contribution else 'returning contributor'})\n"
        f"Description:\n{os.environ.get('PR_BODY') or '(no description provided)'}\n\n"
        f"---\n"
        f"CONTRIBUTING.md contents:\n\n"
        f"{contributing_md}"
    )


def run_pr_review_agent():
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_initial_message()},
    ]
    run_agent(messages, TOOLS, handle_tool_call, MODEL)


if __name__ == "__main__":
    run_pr_review_agent()
