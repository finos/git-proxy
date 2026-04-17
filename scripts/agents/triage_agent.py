import os
import json
import litellm
from github import Github, Auth
from helpers import validate_env_vars, validate_api_keys, run_agent

# Setup

gh = Github(auth=Auth.Token(os.environ["GITHUB_TOKEN"]))
repo = gh.get_repo(os.environ["REPO_NAME"])
issue = repo.get_issue(int(os.environ["ISSUE_NUMBER"]))

LATEST_ISSUES_LIMIT = int(os.environ["LATEST_ISSUES_LIMIT"], 100)
AVAILABLE_LABELS = os.environ.get("AVAILABLE_LABELS", "bug,enhancement,question,documentation,needs-info")
MODEL = os.environ["MODEL"]

validate_env_vars(["GITHUB_TOKEN", "REPO_NAME", "ISSUE_NUMBER", "ISSUE_TITLE", "ISSUE_BODY", "MODEL"])
validate_api_keys()

# Tools

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "apply_label",
            "description": (
                "Apply one or more labels to the issue. "
                "Use labels like: " + AVAILABLE_LABELS
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "labels": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of labels to apply.",
                    }
                },
                "required": ["labels"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "post_comment",
            "description": "Post a comment on the issue, e.g. to ask for clarification or acknowledge receipt.",
            "parameters": {
                "type": "object",
                "properties": {
                    "body": {"type": "string", "description": "The comment text (markdown supported)."}
                },
                "required": ["body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "mark_duplicate",
            "description": (
                "Mark this issue as a duplicate of an existing one. "
                "Use this when the issue is clearly asking about the same thing as an open issue. "
                "Post a comment pointing to the original issue without closing anything."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "original_issue_number": {
                        "type": "integer",
                        "description": "The issue number this is a duplicate of.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Brief explanation of why these issues are duplicates.",
                    },
                },
                "required": ["original_issue_number", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_possible_duplicate",
            "description": (
                "Use when an existing issue is related but not clearly the same thing. "
                "Posts a comment pointing to the similar issue without closing anything."
                "Continue triage normally after posting the comment."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "related_issue_number": {
                        "type": "integer",
                        "description": "The issue number that might be related.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Brief explanation of why these issues seem related.",
                    },
                },
                "required": ["related_issue_number", "reason"],
            },
        },
    },
]

# System prompt

SYSTEM_PROMPT = """You are an issue triage assistant for a GitHub repository.
Given a new issue and a list of existing open issues, follow these steps in order.
No emojis.

1. DUPLICATE CHECK: If the issue clearly duplicates an existing one, call mark_duplicate and stop.
   If it seems related but distinct, call suggest_possible_duplicate and continue triage.
2. LABEL: Apply appropriate labels (bug, enhancement, question, documentation, needs-info, good-first-issue, etc.).
3. NEEDS INFO: If the issue lacks key details (reproduction steps for bugs, use case for features), post a comment asking for them using this format:

Thanks for opening this issue. To help us investigate, please provide:
- <specific missing detail>
... (repeat for each missing detail)

4. ACKNOWLEDGE: If no duplicate was flagged and no needs-info comment was posted, acknowledge receipt with this format:

Thanks for the report. We will take a look.

Do not post acknowledgments on administrative issues such as meeting minutes or roadmaps."""

# GitHub helpers

def get_existing_issues(limit: int = LATEST_ISSUES_LIMIT) -> str:
    """
    Fetches the most recent open issues (excluding the current one)
    and formats them into a string for the prompt.
    """
    open_issues = repo.get_issues(state="open")
    lines = []
    count = 0
    for existing in open_issues:
        if existing.number == issue.number:
            continue
        lines.append(
            f"- #{existing.number}: {existing.title}\n"
            f"  {(existing.body or '').strip()[:200]}"  # truncate long bodies
        )
        count += 1
        if count >= limit:
            break
    return "\n".join(lines) if lines else "(no other open issues)"


def apply_label(labels: list[str]) -> str:
    existing_label_names = [l.name for l in repo.get_labels()]
    for label in labels:
        if label not in existing_label_names:
            repo.create_label(label, "ededed")
    issue.add_to_labels(*labels)
    return f"Applied labels: {labels}"


def post_comment(body: str) -> str:
    issue.create_comment(body)
    return "Comment posted."


def mark_duplicate(original_issue_number: int, reason: str) -> str:
    original = repo.get_issue(original_issue_number)
    issue.create_comment(
        f"This looks like a duplicate of #{original_issue_number} "
        f"({original.html_url}).\n\n> {reason}\n\n"
        f"If you believe it is distinct, please edit this issue with any additional details."
    )
    issue.add_to_labels("duplicate")
    return f"Marked as duplicate of #{original_issue_number}."


def suggest_possible_duplicate(related_issue_number: int, reason: str) -> str:
    related = repo.get_issue(related_issue_number)
    issue.create_comment(
        f"This may be related to #{related_issue_number} "
        f"({related.html_url}): {reason}\n\n"
        f"Please check if that issue already covers what you are reporting."
    )
    return f"Flagged as possibly related to #{related_issue_number}."


# Tool dispatch

def handle_tool_call(name: str, inputs: dict) -> str:
    if name == "apply_label":
        result = apply_label(inputs["labels"])
    elif name == "post_comment":
        result = post_comment(inputs["body"])
    elif name == "mark_duplicate":
        result = mark_duplicate(inputs["original_issue_number"], inputs["reason"])
    elif name == "suggest_possible_duplicate":
        result = suggest_possible_duplicate(inputs["related_issue_number"], inputs["reason"])
    else:
        result = f"Unknown tool: {name}"
    print(f"Tool {name}: {result}")
    return result

# Agentic loop

def build_initial_message() -> str:
    return (
        f"Please triage this new GitHub issue:\n\n"
        f"Title: {os.environ['ISSUE_TITLE']}\n"
        f"Body:\n{os.environ.get('ISSUE_BODY') or '(no description provided)'}\n\n"
        f"---\n"
        f"Here are the currently open issues for duplicate detection:\n\n"
        f"{get_existing_issues()}"
    )


def run_triage_agent():
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_initial_message()},
    ]
    run_agent(messages, TOOLS, handle_tool_call, MODEL)


if __name__ == "__main__":
    run_triage_agent()
