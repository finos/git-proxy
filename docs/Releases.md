# GitProxy Releases

GitProxy has a standardized release process to ensure they are done in a timely manner, and to prevent extensive merge conflicts. We encourage contributors to read this before opening a PR.

## Branching Strategy

GitProxy follows a [GitLabFlow branching strategy](https://about.gitlab.com/topics/version-control/what-is-gitlab-flow/) with **cascade-based merging** for bugfixes as opposed to cherry-picking. [This blogpost](https://blog.joshuins.com/implementing-cascading-merges-in-github-actions-part-1-99a907e566f3) explains in more detail how cascade-based merging works.

There are two types of long-lived branches in GitProxy: `main`, and release branches named `release/X.Y` (example: `release/2.1`). The `main` branch is where we integrate any new PRs. Every feature, refactor, dependency bump, documentation improvement, etc., is opened as a PR against `main`.

When a milestone reaches completion, we cut a `release/X.Y` branch from `main`, and from that point **the branch's scope is frozen**. Only bugfixes are allowed into the release branch.

When a bug affecting a released version is reported, we **open a PR against the oldest supported release branch containing the bug**. After the fix is merged to that branch, we **merge it forward**. Example: Suppose we have the following versions: `1.0`, `1.1`, `2.0`, `2.1`, `2.2` and `3.0`. If a bug affecting `2.0` is discovered, we first merge the fix into `2.0`. Then, we merge `2.0` into `2.1`, `2.1` into `2.2`, and finally `2.2` into `3.0`, which ensures that all affected versions inherit the bugfix. Since commit identity is preserved, a single SHA exists on all branches the fix was applied to. We can then easily audit that a particular version contains a fix by using `git merge-base --is-ancestor`.

Features and changes other than bugfixes never go into a release branch. If you want a feature included in the next minor release, you should target `main` so it gets picked up in the next milestone.

## Release Planning

GitProxy uses [GitHub milestones](https://github.com/finos/git-proxy/milestones) to plan minor and major releases. Milestones have a fixed scope and a target deadline which we agree upon during our fortnightly [Community Meeting](https://github.com/finos/git-proxy#contact). The deadline serves as the intended release date, and allows GitProxy to keep a predictable cadence.

Historically, GitProxy has had [trouble with scope creep](https://github.com/finos/git-proxy/discussions/1442) delaying releases. To remediate this, new features are added to future milestones rather than existing ones, save for rare exceptions. When every issue in a milestone is closed, we create the corresponding `release/X.Y` branch from `main` and the scope is officially frozen.

Patch releases, on the other hand, are excluded from milestone planning as they follow the cascade-merge process described earlier. This means we can ship fixes as soon as they're completed regardless of the planning cycle.

## Versioning

GitProxy follows [Semantic Versioning](https://semver.org/):

- Breaking changes: bump the major version (`1.4.5` bumps to `2.0.0`)
- Backward-compatible features: bump the minor version (`1.4.5` bumps to `1.5.0`)
- Bugfixes, maintenance, documentation, etc.: bump the patch version (`1.4.5` bumps to `1.4.6`)

Version bumps are computed automatically by our [release drafter](https://github.com/finos/git-proxy/blob/main/.github/release-drafter.yml). Thus, we encourage contributors to label their PRs and commits appropriately as described below.

## Pull Request Conventions

Both release notes and the release drafter workflow rely on [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/)-style PR titles for automatic tagging.

- `feat:` labels the PR as a feature (minor bump)
- `fix:` labels the PR as a bugfix (patch bump)
- `break:` or `feat!:` (exclamation mark suffix) labels the PR as a breaking change (major bump)
- Other prefixes map to the maintenance categories defined in `release-drafter.yml`

Release notes use PR titles directly. They should be written as user-facing changelog entries, in other words: in present tense, descriptive, and free of administrative references (meetings, etc.) or jargon.

**Good: ** fix: handle crashing on empty proxy config
**Not good: ** fix: bug from last community call

Keep in mind that maintainers may adjust the labels manually if appropriate.
