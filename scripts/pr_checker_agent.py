import os
import json
import litellm
from github import Github, Auth

# Setup

gh = Github(auth=Auth.Token(os.environ["GITHUB_TOKEN"]))
repo = gh.get_repo(os.environ["REPO_NAME"])
pr = repo.get_pull(int(os.environ["PR_NUMBER"]))
author = os.environ["AUTHOR_USERNAME"]

MODEL = os.environ["MODEL"]
for env_var in ["GITHUB_TOKEN", "REPO_NAME", "PR_NUMBER", "AUTHOR_USERNAME", "MODEL"]:
    if not os.environ[env_var]:
        raise ValueError(f"{env_var} is not set")

valid_api_keys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]
if not any(os.environ.get(api_key) for api_key in valid_api_keys):
    raise ValueError("No API key is set")


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
Given a newly opened PR, its author's contribution history, and the repository's CONTRIBUTING.md,
you must check the following - in this order:

1. FIRST CONTRIBUTION: If this is the author's first contribution to the repo, welcome them warmly.
   Acknowledge their effort and point them to any relevant getting-started resources in CONTRIBUTING.md.

2. DESCRIPTION CLARITY: If the PR description is missing, too vague, or doesn't explain what
   the change does and why, ask for a clearer description.

3. LINKED ISSUE: Check whether the description contains a linked issue using keywords like
   "Fixes #N", "Closes #N", "Resolves #N", or "Related to #N". If no issue is linked,
   ask the author to either link an existing issue or create a new one.

4. CONTRIBUTING.md COMPLIANCE: Check whether the PR description follows the structure or
   requirements defined in CONTRIBUTING.md. If it doesn't comply, quote the relevant section
   and point out specifically what needs to change.

Important rules:
- If multiple concerns apply, combine them into a single comment, never post more than one.
- If everything looks good, stay silent. Do not post a comment just to say things look fine.
- Be warm and constructive, never demanding. Remember this may be someone's first open-source contribution.
- When referencing CONTRIBUTING.md requirements, be specific: quote or paraphrase the rule,
  don't just say "please read the contributing guide".
- Most importantly, be as succinct as possible."""

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
            tool_results.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

        messages.extend(tool_results)


if __name__ == "__main__":
    run_pr_review_agent()
