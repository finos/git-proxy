---
name: Roadmap
about: Pinned roadmap issue built from a roadmap meeting and each organisation's ranked priorities
title: '{{PROJECT}} {{VERSION_OR_PERIOD}} Roadmap'
labels: ['roadmap']
assignees: []
---

<!--
=====================================================================
ROADMAP TEMPLATE — INSTRUCTIONS (delete this comment before posting)
Written for both humans and AI assistants. Follow the steps in order.
=====================================================================

INPUTS
  A. Roadmap meeting minutes (issue link) — the "Source".
  B. One RANKED priority list per participating organisation
     (usually posted as comments on the minutes issue).
  C. Existing open issues/PRs in the repo that match those priorities.
  D. The previous roadmap issue, if any.

STEP 1 — Build roadmap items
  - Merge asks from different orgs that describe the same deliverable.
  - Split asks that would ship separately (e.g. "user onboarding" vs
    "project onboarding" vs "fork management" are three items).
  - Name each item with a short noun phrase ("PostgreSQL backend",
    not "We should add Postgres support").

STEP 2 — Assign Tiers (based on demand). Count how many orgs raised each item:
  - Tier 1: raised by 3+ orgs
  - Tier 2: raised by 2 orgs, OR it was any single org's #1 priority
  - Tier 3: raised by a single org
  For projects with few participating orgs, Tier 1 may instead be
  "at least half of participating orgs (min. 2)". State the rule used
  in the Glossary. Never assign tiers by perceived importance alone.

STEP 3 — Assign Size (effort estimate)
  - 🟢 Easy win: a few days of work or less
  - 🟡 Medium: needs design or several PRs
  - 🔴 Large: cross-cutting, or likely to introduce breaking changes
  - N/A: non-code items (governance, process)

STEP 4 — Assign Status (from the linked issues/PRs)
  - ⚪ Not started: no issue exists yet
  - 🔵 Issue drafted: a tracking issue exists, no PR
  - 🟠 In progress: an open PR or active work exists
  - ✅ Done: merged/closed as completed
  Status emojis deliberately differ from Size emojis so the two
  columns can't be confused in the Overview table.

STEP 5 — Fill each item section
  - Owners: take from the minutes' action items. If none, write TBD.
  - Depends on / Enables / Blocks: item numbers only, omit if none.
  - Description: 1–2 sentences on the problem, not the solution.
  - Sub-issues/PRs: link real issues as "- [ ] #123" (GitHub renders
    the title). For work without an issue, write a short deliverable.
    NEVER invent issue or PR numbers.

STEP 6 — Fill the Overview table
  - One row per item, same numbering as the sections.
  - Link each item to its heading anchor. GitHub anchors are the
    heading text lowercased, punctuation removed (except hyphens),
    spaces replaced by hyphens. Examples:
      "### 2. Event hooks & notifications" -> #2-event-hooks--notifications
      "### 3. Security: zero known CVEs"   -> #3-security-zero-known-cves

STEP 7 — Publish
  - Number items continuously across tiers (1..N), Tier 1 first.
  - Remove unused example items and all {{PLACEHOLDERS}}.
  - Pin the new issue; unpin the previous roadmap and link it below.

RULES
  - Record which orgs RAISED an item only in the source minutes, not
    here: this roadmap lists demand tiers, not which companies want what.
    (FINOS meetings are subject to the LF Antitrust Policy.)
  - Keep wording neutral: "raised by", never "required/approved by".
  - Don't reorder within a tier by opinion; order by dependencies first,
    then by how highly orgs ranked the item.
=====================================================================
-->

# {{PROJECT}} {{VERSION_OR_PERIOD}} Roadmap

{{ONE_SENTENCE_OVERVIEW — e.g. "An overview of where {{PROJECT}} is headed and what the community wants."}} Previous issue #{{PREVIOUS_ROADMAP_ISSUE}}.

**Status:** {{Draft, to be reviewed in next Community call | Confirmed}}
**Last reviewed:** {{YYYY-MM-DD}}
**Next review:** {{YYYY-MM-DD}}
**Source:** {{DATE}} roadmap meeting minutes and comments (#{{MINUTES_ISSUE}})

## Glossary

Each item is classified according to importance, size and status. Maintainers update the status emoji as work progresses.

| Category   | Description                            | Values                                                                                                        |
| ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Importance | How many organisations raised the item | Tier 1: raised by 3+ orgs, Tier 2: raised by 2 orgs (or an org's #1 priority), Tier 3: raised by a single org |
| Size       | Estimated effort                       | 🟢 Easy win, 🟡 Medium, 🔴 Large (or breaking), N/A (non-code)                                                |
| Status     | Development progress                   | ⚪ Not started, 🔵 Issue drafted, 🟠 In progress, 🟣 Ready for review, ✅ Done                                |

## Overview

# | Item | Tier | Size | Status

:-: | -- | :-: | :-: | :-:
1 | [{{ITEM_NAME}}](#1-{{item-anchor}}) | 1 | 🔴 | 🟠
2 | [{{ITEM_NAME}}](#2-{{item-anchor}}) | 2 | 🟡 | 🔵
3 | [{{ITEM_NAME}}](#3-{{item-anchor}}) | 3 | 🟢 | ⚪

---

## Tier 1: high demand

### 1. {{ITEM_NAME}}

Size: {{🟢 | 🟡 | 🔴 | N/A}} | Owners: {{@handle, @handle | TBD}} | Blocks: {{item numbers}}

{{1–2 sentences: what problem this solves and why it matters. Mention if other items depend on it.}}

#### Sub-issues/PRs

- [ ] #{{ISSUE_OR_PR}}
- [ ] {{Deliverable without an issue yet}}

---

## Tier 2: medium demand OR an organisation's top pick

### 2. {{ITEM_NAME}}

Size: {{🟢 | 🟡 | 🔴 | N/A}} | Owners: {{@handle | TBD}} | Depends on: {{item numbers}}

{{1–2 sentences: what problem this solves.}}

#### Sub-issues/PRs

- [ ] #{{ISSUE_OR_PR}}
- [ ] {{Deliverable without an issue yet}}

---

## Tier 3: raised by a single organisation

### 3. {{ITEM_NAME}}

Size: {{🟢 | 🟡 | 🔴 | N/A}} | Owners: {{@handle | TBD}} | Enables: {{item numbers}}

#### Sub-issues/PRs

- [ ] {{Deliverable without an issue yet}}

---

### Adding your desired features

If you want to extend or modify this list with your organisation's priorities, please leave a comment with your desired features, ranked by importance. If a feature is requested by multiple organisations, it will be upgraded to the next tier.

### Picking up an issue

If you've started working on an issue, leave a comment here so maintainers can keep this roadmap up-to-date.

### Missing sub-issues

If any roadmap item is missing a sub-issue, open an issue for it and/or link it here.

### Updates/comments

This issue is reviewed at each roadmap meeting. Maintainers will update the tiers, status and sub-issues based on any comments posted.
