import os
import anthropic
from github import Github, Auth

# Setup

gh = Github(auth=Auth.Token(os.environ["GITHUB_TOKEN"]))
repo = gh.get_repo(os.environ["REPO_NAME"])
issue = repo.get_issue(int(os.environ["ISSUE_NUMBER"]))
client = anthropic.Anthropic()

LATEST_ISSUES_LIMIT = 100

# Tools

TOOLS = [
    {
        "name": "apply_label",
        "description": (
            "Apply one or more labels to the issue. "
            "Use labels like: automation, bug, dependencies, "
            "documentation, enhancement, good-first-issue, "
            "meeting, needs-info, plugins, protocol, question, "
            "security, tech-debt, testing."
        ),
        "input_schema": {
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
    {
        "name": "post_comment",
        "description": "Post a comment on the issue, e.g. to ask for clarification or acknowledge receipt.",
        "input_schema": {
            "type": "object",
            "properties": {
                "body": {"type": "string", "description": "The comment text (markdown supported)."}
            },
            "required": ["body"],
        },
    },
    {
        "name": "mark_duplicate",
        "description": (
            "Mark this issue as a duplicate of an existing one. "
            "Use this when the issue is clearly asking about the same thing as an open issue. "
            "This will post a comment pointing to the original, however the issue will remain open for maintainers to address."
        ),
        "input_schema": {
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
    {
        "name": "suggest_possible_duplicate",
        "description": (
            "Use when an existing issue is related but not clearly the same thing. "
            "Posts a comment pointing to the similar issue without closing anything. "
            "Triage should still continue normally after calling this."
        ),
        "input_schema": {
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
]

# System prompt

SYSTEM_PROMPT = """You are an issue triage assistant for a GitHub repository.
Given a new issue and a list of existing open issues, you must:

1. Check whether the new issue is a duplicate of an existing one.
   - If it clearly is the same issue, call mark_duplicate and stop — do not label or acknowledge further.
   - If it seems related but could be distinct, call suggest_possible_duplicate. That comment
     will serve as the acknowledgment too, so do NOT post a separate acknowledgment afterward.
2. Otherwise, classify it by applying appropriate labels
   (bug, feature-request, question, documentation, needs-info, good-first-issue).
3. If the issue is missing key info (steps to reproduce for bugs, use case for features, etc.),
   post a friendly comment asking for it.
4. If no possible duplicate was flagged, post a short acknowledgment comment so the
   author knows their issue was received. Do NOT post comments on administrative issues
   such as meeting minutes, roadmaps, etc.

Keep comments concise and friendly."""

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
        f"Thanks for the report! This looks like a duplicate of #{original_issue_number} "
        f"({original.html_url}).\n\n> {reason}\n\n"
        f"Please edit this issue to add any distinguishing details if you believe it's not a duplicate."
    )
    issue.add_to_labels("duplicate")
    return f"Marked as duplicate of #{original_issue_number}."


def suggest_possible_duplicate(related_issue_number: int, reason: str) -> str:
    related = repo.get_issue(related_issue_number)
    issue.create_comment(
        f"Hey! This might be related to #{related_issue_number} "
        f"({related.html_url}) — {reason}\n\n"
        f"Feel free to check if that one already covers what you're reporting!"
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
    messages = [{"role": "user", "content": build_initial_message()}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            break

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            result = handle_tool_call(block.name, block.input)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result,
            })

        messages.append({"role": "user", "content": tool_results})


if __name__ == "__main__":
    run_triage_agent()
