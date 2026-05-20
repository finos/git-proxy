# Releases

GitProxy has a standardized release process to ensure they are done in a timely manner, and to prevent extensive merge conflicts. We encourage contributors to read this before opening a PR.

## Branching Strategy

GitProxy follows a [GitLabFlow branching strategy](https://about.gitlab.com/topics/version-control/what-is-gitlab-flow/) with **cascade-based merging** for bugfixes as opposed to cherry-picking. [This blogpost](https://blog.joshuins.com/implementing-cascading-merges-in-github-actions-part-1-99a907e566f3) explains in more detail how cascade-based merging works. See this [StackExchange discussion](https://softwareengineering.stackexchange.com/questions/460758/is-cascade-merging-forward-porting-riskier-than-backporting) for pros and cons of cascade-based merging.

There are two types of long-lived branches in GitProxy: `main`, and release branches named `release/X.Y` (example: `release/2.1`). The `main` branch is where we integrate any new PRs. Every feature, refactor, dependency bump, documentation improvement, etc., is opened as a PR against `main`.

When a milestone reaches completion, we cut a `release/X.Y` branch from `main`, and from that point **the branch's scope is frozen**. Only bugfixes are allowed into the release branch.

When a bug affecting a released version is reported, we **open a PR against the oldest supported release branch containing the bug**. After the fix is merged to that branch, we **merge it forward**. Suppose we support the following versions: `1.1`, `2.2` and `3.0`. If a bug affecting `2.2` is discovered, we first merge the fix into `2.2`. Then, we merge `2.2` into `3.0`, which ensures that all affected, supported versions inherit the bugfix. Since commit identity is preserved, a single SHA exists on all branches the fix was applied to. We can then easily audit that a particular version contains a fix by using `git merge-base --is-ancestor`.

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

Version bumps are computed automatically by our release drafter workflow, based on this [configuration file](https://github.com/finos/git-proxy/blob/main/.github/release-drafter-config.yml). Thus, we encourage contributors to label their PRs and commits appropriately as described below.

## Pull Request Conventions

Both release notes and the release drafter workflow rely on [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/)-style PR titles for automatic tagging.

- `feat:` labels the PR as a feature (minor bump)
- `fix:` labels the PR as a bugfix (patch bump)
- `break:` labels the PR as a breaking change (major bump)
- Adding an exclamation mark (ex: `feat!:`) also labels the PR as a breaking change (major bump)
- Other prefixes map to the maintenance categories defined in `release-drafter.yml`

Release notes use PR titles directly. They should be written as user-facing changelog entries, in other words: in present tense, descriptive, and free of administrative references (meetings, etc.) or jargon.

- **Good:** fix: handle crashing on empty proxy config
- **Not good:** fix: bug from last community call

Keep in mind that maintainers may adjust the labels manually if appropriate.

## Release Process

The actual release process is largely automated via two GitHub Actions workflows: [`release-drafter.yml`](https://github.com/finos/git-proxy/blob/main/.github/workflows/release-drafter.yml) and [`npm.yml`](https://github.com/finos/git-proxy/blob/main/.github/workflows/npm.yml).

### Release Drafter

This workflow runs whenever:

1. You create a `release/*` branch from `main`
2. You push to an existing `release/*` branch

It generates a draft GitHub Release, which is kept up-to-date with a categorised changelog and the right version number. The release drafter action can be customized in [release-drafter-config.yml](https://github.com/finos/git-proxy/blob/main/.github/release-drafter-config.yml).

When a release is ready to ship, a maintainer:

1. Reviews the draft for the relevant `release/*` branch
2. Edits the release notes if necessary (for instance, adding a migration guide for breaking changes)
3. Clicks Publish.

Publishing creates a git tag, and triggers the `npm.yml` workflow described below.

### Publish to NPM

This workflow runs whenever you publish a GitHub release. As of writing, we don't have any [automation for bumping the versions](https://github.com/finos/git-proxy/issues/1533) in `/package.json` and `/packages/git-proxy-cli/package.json`. You'll have to manually set these according to the appropriate semantic version generated by the release drafter.

As detailed in [`npm.yml`](https://github.com/finos/git-proxy/blob/main/.github/workflows/npm.yml), it:

1. Builds the package
2. Detects whether it's the latest version, according to the current `package.json` (e.g.: if the version you're publishing is `2.3`, and the latest on NPM `2.2`)

- If it's the latest version, it gets tagged as `'latest'` which is the default version that gets installed when calling `npx @finos/git-proxy`
- If it's a maintenance release on an older line, it gets tagged as `release-X.Y` so users can pin it explicitly if needed (either via the tag, or the version itself)

3. Publishes the package to NPM with the tag defined above

### Publishing a Patch Release

For patch releases, the same process applies. The only difference is that first we must perform the cascade-based merge flow from above:

First, we make a PR against the earliest supported version where the bug can be reproduced. Deprecated versions need not inherit the fix. Then, we open a PR against that version's release branch, ex. `release/2.2`. Once the bugfix has been merged, this automatically generates a draft release with a patch bump (ex. `2.2.0` -> `2.2.1`). We **must publish the release** (to prevent the draft from getting overwritten). Finally, we merge (_cascade_) the `release/2.2` branch into the next supported version, ex. `release/3.0`, and repeat the publishing process.

### Cheatsheet and Troubleshooting

The flows are roughly as follows:

#### Releases

1. You merge new PRs to `main`
2. When a milestone is completed, make a PR to bump the GitProxy version on all of the relevant `package.json` files. This is necessary for publishing to NPM.
3. Make a `release/X.Y` branch to freeze feature development. New features and improvements go into `main`, not into the `release/X.Y` branch
4. Upon creating the branch, a draft release is automatically generated.
5. Review the draft release notes, and click Publish if appropriate. This will automatically build and publish to NPM

#### Patches

1. Figure out which is the earliest _supported_ version where the bug can be reproduced. Suppose the latest two major versions are supported (`1.20.x` and `2.2.x`), then we only care about reproducing the bug on `release/1.20` and `release/2.2`.
2. Fix the bug and make a PR against the relevant version
3. In this PR, you **must** also bump the GitProxy version on all relevant `package.json` files for publishing to NPM (ex: `1.20.0` -> `1.20.1`)
4. Once the PR is merged, a draft release will be generated to bump the patch version
5. Review the draft release notes and publish if appropriate. This will automatically **update** the NPM `release-1.20` line with the patched package. **Tip: Don't forget to uncheck the "Set as latest release" default option**
6. Then, make a PR to merge the `release/1.20` branch into `release/2.2`. **Don't forget to bump the GitProxy version for the new line** (ex: `2.2.0` -> `2.2.1`)
7. Repeat steps 4-6 until all the supported versions have been published to both GitHub and NPM

#### Troubleshooting

##### My draft release got overwritten!

This usually happens when forgetting to publish the draft for an older release branch (during cascade merges).

Just re-run the `release-drafter.yml` workflow from the related release branch. Example: If your `1.2.x` draft got overwritten, go to the [Release Drafter action page](https://github.com/finos/git-proxy/actions/workflows/release-drafter.yml), click on the run matching the latest `release/1.2` branch, and then click "Re-run all jobs".

##### I published the draft release and forgot to bump the `package.json`s!

Usually, this will fail to publish to NPM at all. Just delete the bad release from the [GitHub releases page](https://github.com/finos/git-proxy/releases), delete the old related tag, then make a PR to the relevant `release/X.Y` branch bumping the `package.json` versions. When the PR is merged, publish the draft release making sure that a new tag is being created. This should trigger the NPM publish workflow and publish the updated package or override the existing one.

## Questions

If you have any questions or suggestions regarding releases, feel free to [open a discussion](https://github.com/finos/git-proxy/discussions).
