# Upgrading to GitProxy v2

This guide attempts to cover everything needed for a seamless upgrade from GitProxy v1 (`1.19.2`) to v2.

Most errors will be related to invalid database records added in v1 - mainly in the `user` and `repo` databases. As of writing, database migration files are not provided.

## Breaking changes

Two important breaking changes were made:

### Associate commits by email

Commits are no longer associated by Git's `user.name`. Now, they're associated by email (to match the handling of commits by GitHub, GitLab and other SCM providers), which allows Git Proxy to handle multiple SCM providers. [#973](github.com/finos/git-proxy/pull/973)

In practice, pushes that were working in v1 (made with an improperly configured git client) may be blocked in v2 due to the change in requirements. The user's GitProxy email must match the commit's email (Git's `user.email`). This is often already required by a firm's contribution policy or to pass a CLA (Contributor License Agreement) check on a project.

### Support for GitLab and other Git hosts

Added support for Git SCM hosts other than GitHub. Eliminated assumptions about GitHub as the Git repository host. [#1043](https://github.com/finos/git-proxy/pull/1043)

Repositories are no longer identified by name, but by internal ID instead. This means that multiple forks of the same repo are now supported, as well as repos for other Git host (GitLab, etc.).

From v2 onwards, Git Proxy git URLs include the domain of the git host (e.g. https://git-proxydomain.net:8443/org/project.git has changed to https://git-proxydomain.net:8443/github.com/org/project.git). Backwards compatibility was implemented to ensure that these older URLs don't break. However, users should be advised to update the URL used in their remote in case this is removed in a subsequent major release.

## Troubleshooting typical errors

Most of these errors can be easily **fixed by simply accessing the UI** to delete the offending repository, add it again, and restore all the allowed users. Manually editing the database entries is not recommended, but also works.

If you encounter any errors not on this guide, feel free to [open a discussion](https://github.com/finos/git-proxy/discussions).

### Errors when pushing to a repo that was working in v1:

#### fatal: <repo-url>/info/refs not valid: is this git repository?

`git push` returns:

```
fatal: <repo-url>/info/refs not valid: is this git repository?
```

This error happens when pushing to GitProxy with a mismatched URL.

In v1, Git URLs without the trailing `.git` were considered valid:

```
"url": "https://github.com/my-org/my-repo"
```

In v2, URLs are automatically formatted when adding a repo. **Repos added in v1 must be edited or re-added to fix this error**:

```
"url": "https://github.com/my-org/my-repo.git"
```

#### Your push has been blocked (<email> is not allowed to push on repo <repo-url>)

`git push` returns:

```
Your push has been blocked (<email> is not allowed to push on repo <repo-url>)
```

This error occurs when pushing to GitProxy without being in the `canPush` list. This error can also occur when no GitProxy users match the given email.

In v1, authorised users were matched based on `gitAccount` (which was actually the Git `user.name` and mistakenly being used as the GitHub username in the UI):

```
"users":{"canPush":["John Doe"],"canAuthorise":["John Doe","admin"]}
```

In v2, authorised users are identified by the email address associated with their GitProxy username. The email associated with the push (Git config `user.email`) must match their GitProxy email:

Repo data:

```
{"users":{"canPush":["johndoe123"],"canAuthorise":["johndoe123","admin"]"}, ...}`
```

User data:

```
{"username":"johndoe123","gitAccount":"<does-not-matter>","email":"<email>", ...}
```

Changing the email address associated with commits can be accomplished via a number of routes, including 'rewriting history' [using rebase](https://stackoverflow.com/questions/750172/how-do-i-change-the-author-and-committer-name-email-for-multiple-commits) (dangerous but preserves the commits) or creating new commits with the correct metadata (safer but involves creating a new history/branch).

## Other notable changes

### Features

- Replaced `getMissingData` action with `checkEmptyBranch` to handle empty branch processing in [#1134](https://github.com/finos/git-proxy/pull/1134)
  - `getMissingData` was setting the `Commit` object's `committer` to the `author_name` which is not always true. Furthermore, the edge case that `getMissingData` was trying to solve was already covered by the `checkHiddenCommits` action
  - `checkEmptyBranch` simply checks whether the branch has had any new commits (if not, the push will be rejected)
- Added a settings page for configuring the JWT token to authenticate UI requests to API when `apiAuthentication` is enabled in [#1096](https://github.com/finos/git-proxy/pull/1096)
  - Previously, requests from the UI were bypassing the JWT check if the user was logged in, and failing otherwise when `apiAuthentication` was set
  - For more details on setting JWT, check the [architecture documentation](./Architecture.md#setting-up-jwt-authentication):
- Added the ability to create new users via the GitProxy CLI in [#981](https://github.com/finos/git-proxy/pull/981)
- Added `/healthcheck` endpoint for AWS Load Balancer support [#1197](https://github.com/finos/git-proxy/pull/1197)
- Improved login page flexibility, error handling and visibility of available auth methods in [#1227](https://github.com/finos/git-proxy/pull/1227)
- Added config schema for `commitConfig`, `attestationConfig` and `domains` in [#1243](https://github.com/finos/git-proxy/pull/1243)
  - See the [schema reference](https://git-proxy.finos.org/docs/configuration/reference) for a detailed description of each
  - Also removes the defunct `api.github` config element
- Added confirmation dialog to `RepoDetails` page to prevent accidental repository deletions in [#1267](https://github.com/finos/git-proxy/pull/1267)
- Added support for using AWS Credential Provider to authenticate MongoDB connections in [#1319](https://github.com/finos/git-proxy/pull/1319)
- Optimized push speed by performing shallow clones by default in [#1189](https://github.com/finos/git-proxy/pull/1189)
  - Increased push speeds for larger repos [by around 30~50%](https://github.com/finos/git-proxy/issues/985)
- Improved configuration validation and typing in [#1140](https://github.com/finos/git-proxy/pull/1140)

### Bugfixes

- Fixed issue where requests for unknown repos were being forwarded to GitHub instead of being blocked as expected in [#1163](https://github.com/finos/git-proxy/issues/1163)
  - Improved error handling on chain execution to ensure errors always block pushes
  - Ensured `checkRepoInAuthList` is run for all requests
- Fixed MongoDB client implementation issues (not awaiting promises, searching repos against the wrong field) in [#1167](https://github.com/finos/git-proxy/pull/1167)
- Fixed issues with Git client not rendering error messages on rejected pushes in [#1178](https://github.com/finos/git-proxy/pull/1178)
  - Reverted previous changes to status codes on rejected pushes since the Git client only renders errors on `200 OK`
- Fixed Push table committer and author links, replaced links to profile with `mailto:` in [#1179](https://github.com/finos/git-proxy/pull/1179)
- Fixed display errors when adding a new repo in [#1120](https://github.com/finos/git-proxy/pull/1120)
  - Caused by an issue with server side errors being silently ignored
- Fixed `--force` pushes failing due to the `getDiff` action blocking legitimate empty diffs in [#1182](https://github.com/finos/git-proxy/pull/1182)
- Fixed incorrect error message on cloning unauthorized repos in [#1204](https://github.com/finos/git-proxy/pull/1204)
  - Caused by improper Git protocol error handling for `GET /info/refs` requests, resulting in Git client receiving malformed `upload-pack` data
- Fixed duplicated chain execution when pushing a PR that has been approved in [#1209](https://github.com/finos/git-proxy/pull/1209)
  - Caused by an issue with raw body extraction on `POST git-pack` requests
- Reimplemented push parsing to fix various issues related to packfile decoding in [#1187](https://github.com/finos/git-proxy/pull/1187)
  - Fixed `Z_DATA_ERROR` when pushing
  - Fixed Git object header parsing and packfile metadata reading
  - Reimplemented decompression to better replicate how Git handles it (replaced inflating/deflating the object)
- Fixed logout failure in production caused by UI defaulting to `http://localhost:3000` when `VITE_API_URI` is unset in [#1201](https://github.com/finos/git-proxy/pull/1201)
  - Refactors API URL usages to rely on a single source of truth, sets default values
- Fixed a potential denial-of-service vulnerability when pushing to an unknown repository in [#1095](https://github.com/finos/git-proxy/pull/1095)
  - Caused by a bug in the MongoDB implementation `isUserPushAllowed` which assumed that the repository exists. If the repository wasn't found, the backend crashed when attempting to access its properties
- Fixed `MongoServerError` when updating user due to attempting to override the pre-existent `_id` in [#1230](https://github.com/finos/git-proxy/pull/1230)
- Fixed error with `commitConfig.diff.block.literals` entry being matched as regular expressions instead in [#1251](https://github.com/finos/git-proxy/pull/1251)
- Fixed infinite loop in `UserList` component causing excessive API requests and preventing proper rendering in [#1255](https://github.com/finos/git-proxy/pull/1255)
- Fixed broken user links in `PushDetails` and `RepoDetails` components in [#1268](https://github.com/finos/git-proxy/pull/1268)
  - Created `UserLink` component to centralise user navigation
- Fixed pagination component to show correct page count when no data is available in [#1274](https://github.com/finos/git-proxy/pull/1274)
- Fixed proxy startup failure due to default repo mismatch in [#1284](https://github.com/finos/git-proxy/pull/1284)
  - Caused by matching repos by name instead of URL on calling `proxyPreparations`
- Fixed error when making subsequent pushes to a new branch in [#1291](https://github.com/finos/git-proxy/pull/1291)
  - `Error: fatal: Invalid revision range` was being thrown on valid pushes to new branches
  - Caused by setting `singleBranch: true` when pulling the remote repo for optimization purposes
  - Removal of this option does not affect pull/push times considerably. Rudimentary benchmarks show that despite removing the option, push speeds [are still considerably faster](https://github.com/finos/git-proxy/pull/1305#issuecomment-3611774012) than without the `depth: 1` optimization
- Fixed misleading backend status codes and improved UI error handling in [#1293](https://github.com/finos/git-proxy/pull/1293)
  - Also removed redundant `/api/auth/me` endpoint
- Fixed race condition preventing MongoDB connection when loading configuration in [#1316](https://github.com/finos/git-proxy/pull/1316)
  - Deferred retrieval of database config allowing the user configuration to be loaded before attempting to use it
- Replaced `jwk-to-pem` dependency with native `crypto` to remove vulnerable dependency (`elliptic`) in [#1283](https://github.com/finos/git-proxy/pull/1283)
