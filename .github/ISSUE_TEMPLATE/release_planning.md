# Release vX.Y.Z Planning

> **Release Goal:** _One or two sentences describing what this release achieves and why it matters. Keep it scope-defining._

- **Target Date:** YYYY-MM-DD
- **Release Manager:** @username

---

## Breaking Changes

_List any changes that break backward compatibility. If none, write "None."_

- [ ] `[ChangeDescription]` — _What it breaks and what users should do instead._

---

## Issues and PRs

_List issues and PRs along with their current status (example:_ `Planned`, `In progress`, `Awaiting review`, `Awaiting changes`, `Ready to merge`, `Merged`, `Postponed`, `Moved to vX.Y`_)_

### Features

| Issue / PR | Feature       | Description         | Status            |
| ---------- | ------------- | ------------------- | ----------------- |
| [#](#)     | `FeatureName` | _Short description_ | `Planned`         |
| [#](#)     | `FeatureName` | _Short description_ | `Awaiting review` |

---

### Improvements & Refactors

_Performance/tooling improvements, refactors, dependency upgrades, etc._

| Issue / PR | Improvement       | Description     | Status             |
| ---------- | ----------------- | --------------- | ------------------ |
| [#](#)     | `ImprovementName` | _Short summary_ | `Awaiting changes` |

---

### 🐛 Bug Fixes

_Bugs confirmed for this release. Urgent bugs discovered mid-cycle can be added here as they come up._

| Issue / PR | Bug       | Description     | Status        |
| ---------- | --------- | --------------- | ------------- |
| [#](#)     | `BugName` | _Short summary_ | `Merged`      |
| [#](#)     | `BugName` | _Short summary_ | `In progress` |

---

## Testing Checklist

_Things to verify before cutting the release._

- [ ] CI tests pass (unit, e2e, integration)
- [ ] Manual smoke tests on critical flows
