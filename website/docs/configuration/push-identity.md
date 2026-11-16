---
title: Push identity
description: How GitProxy decides who is pushing, and how to configure the SCM providers it asks
---

# Push identity

Every decision GitProxy makes about a push starts with the same question: who is pushing? Whether the pusher is on the repository's contributor list, whether they may cancel the push later, and whether a reviewer is trying to approve their own change all depend on the answer.

The answer is taken from the credential that accompanied the push, never from the pushed objects. The `author`, `committer` and `tagger` lines inside a commit or tag are text the client wrote and can say anything. A push whose identity cannot be established from a credential is blocked.

## Where the identity comes from

| How the push arrives                          | Identity source                                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| HTTPS with a token in the Basic-auth password | The upstream SCM is asked which account the token belongs to, and that account is looked up on GitProxy's user records. |
| SSH                                           | The SSH key was already matched to a GitProxy user during authentication.                                               |
| Dashboard session                             | The logged-in user.                                                                                                     |

For HTTPS pushes the Basic-auth username half is ignored: git sends whatever the user typed or their credential helper stored, and nothing verifies it. Only the token is used.

The step that does this is [`resolveUserFromToken`](../architecture/processors.md#resolveuserfromtoken). It runs first in both the branch and the tag chains.

## Configuring SCM providers

GitProxy needs to know how to ask each git host about a token. That is the `scmProviders` list in `proxy.config.json`:

```json
"scmProviders": [
  { "name": "github", "type": "github", "host": "github.com" },
  { "name": "gitlab", "type": "gitlab", "host": "gitlab.com" },
  { "name": "codeberg", "type": "forgejo", "host": "codeberg.org" },
  { "name": "gitea", "type": "forgejo", "host": "gitea.com" }
]
```

Those four entries are the built-in defaults. Setting `scmProviders` in your own configuration replaces the list, so include the defaults you still want.

| Field    | Meaning                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`   | Identifier for this provider. It is the key under which users link their account, so changing it unlinks everyone.                                             |
| `type`   | Which API the host speaks: `github`, `gitlab` or `forgejo`. Gitea and Codeberg speak the Forgejo API.                                                          |
| `host`   | Hostname of the git remote, exactly as it appears in the repository URL. Matched case-insensitively, without a port.                                           |
| `apiUrl` | Optional base URL of the REST API. Derived from `host` and `type` when omitted; set it when the API is fronted from elsewhere or served on a non-default port. |

### How the API location is derived

| `type`    | `host`                        | Endpoint asked                      | Credential sent           | Field read |
| --------- | ----------------------------- | ----------------------------------- | ------------------------- | ---------- |
| `github`  | `github.com`                  | `https://api.github.com/user`       | `Authorization: token …`  | `login`    |
| `github`  | `<tenant>.ghe.com`            | `https://api.<tenant>.ghe.com/user` | `Authorization: token …`  | `login`    |
| `github`  | any other (Enterprise Server) | `https://<host>/api/v3/user`        | `Authorization: token …`  | `login`    |
| `gitlab`  | any                           | `https://<host>/api/v4/user`        | `Authorization: Bearer …` | `username` |
| `forgejo` | any                           | `https://<host>/api/v1/user`        | `Authorization: token …`  | `login`    |

The token needs whatever scope the host requires to read its own owner: `read:user` on GitHub and Forgejo-family hosts, `read_user` or `api` on GitLab. Fine-grained GitHub tokens can read the token owner without any extra permission.

Examples for self-hosted instances:

```json
"scmProviders": [
  { "name": "github", "type": "github", "host": "github.com" },
  { "name": "ghes", "type": "github", "host": "github.corp.example.com" },
  { "name": "gitlab", "type": "gitlab", "host": "gitlab.corp.example.com" },
  { "name": "forge", "type": "forgejo", "host": "forge.corp.example.com" }
]
```

A push to a host with no matching provider is blocked with a message naming the host.

### Well-known hosts are pinned to their type

GitProxy refuses to start if `github.com` (or a `*.ghe.com` tenant), `gitlab.com`, `codeberg.org` or `gitea.com` is configured with any type other than its own. Configuring `github.com` as `forgejo`, for example, would send GitHub tokens to an API path that does not exist there and block every push to it, while a typo the other way would send Forgejo tokens to GitHub. Self-hosted hosts cannot be checked this way and are taken as configured, so review those entries with the same care as the rest of the authentication configuration. Duplicate names and duplicate hosts are also rejected.

### Caching

A token that resolved successfully is remembered for seven days, keyed by a SHA-512 hash of the provider name and the token. The cache stores which SCM account the token belongs to, not which GitProxy user; the account-to-user lookup runs on every push, so linking or unlinking an account takes effect immediately. Rejected tokens are not cached. The cache is in memory and empties on restart.

## Linking accounts to users

A user record carries a map of provider name to account handle:

```json
{
  "username": "jdoe",
  "email": "jdoe@example.com",
  "scmIdentities": { "github": "jdoe-gh", "gitlab": "jdoe" }
}
```

Handles are stored lower-cased and matched case-insensitively. A handle can be linked to one user per provider.

Link or unlink through the API while logged in:

```bash
# link your own account
curl -X POST http://localhost:8080/api/auth/scm-identity \
  -H 'Content-Type: application/json' -b cookies \
  -d '{"provider":"github","login":"jdoe-gh"}'

# an admin linking someone else's
curl -X POST http://localhost:8080/api/auth/scm-identity \
  -H 'Content-Type: application/json' -b cookies \
  -d '{"username":"jdoe","provider":"gitlab","login":"jdoe"}'

# unlink
curl -X POST http://localhost:8080/api/auth/scm-identity \
  -H 'Content-Type: application/json' -b cookies \
  -d '{"provider":"gitlab","login":null}'
```

Admins can also pass `scmIdentities` when creating a user through `POST /api/auth/create-user`.

## What a pusher sees

A push that cannot be attributed is rejected before any other check runs, with one of:

```
Push blocked: no credentials were presented, so the pusher cannot be identified.
Push blocked: github did not accept the credential presented with this push (invalid token, or missing the scope to read the token owner).
Push blocked: github account 'jdoe-gh' is not linked to a git-proxy user. Link it from your profile or ask an administrator.
Push blocked: no SCM provider is configured for host 'git.example.com', so the pusher cannot be identified. Add the host to 'scmProviders' in the proxy configuration.
```

Once attributed, `checkUserPushPermission` checks the resolved user against the repository's `canPush` list, and the dashboard's four-eyes rule compares the reviewer against the resolved user.

## Upgrading an existing deployment

This is a breaking change. Previously, when a token could not be resolved or the resolved account was not linked, GitProxy fell back to the last commit's `committer` line as the pusher. That fallback is gone.

What changes for an existing deployment:

- **Pushes to github.com** keep working once each user's account is linked. The `gitAccount` field on existing users is carried over as their `github` identity by a migration on startup, so users who had set it correctly need to do nothing. Users whose `gitAccount` was blank, or the seed value `none`, have to link. A handle that more than one user had set, or that another user has already linked, identifies nobody: the migration links none of them and logs a warning, and an administrator has to decide who owns it.
- **Pushes held for approval before the upgrade** cannot be approved. Their pusher was recorded from the pushed objects, so the four-eyes rule cannot be applied to them; the dashboard refuses with a message asking for a fresh push, and an approval already granted to such a push is not reused. Pushing again records the pusher from the credential and creates a reviewable record in its place.
- **Pushes to any other host** are blocked until that host is listed under `scmProviders`.
- **Tag pushes** now go through identity resolution too. Previously they were attributed to the tagger line.
- **`POST /api/auth/gitAccount`** is replaced by `POST /api/auth/scm-identity`. `POST /api/auth/create-user` no longer requires `gitAccount`.
- **`git-proxy-cli create-user`** no longer takes `--gitAccount`.
- **The repository `canPush` and `canAuthorise` lists** are unchanged. They still hold GitProxy usernames.
