# GitProxy Architecture

This guide explains GitProxy's various components, and how they communicate with each other when performing a `git push`.

As mentioned in [the README](/README.md), GitProxy is an application that intercepts pushes and applies rules/policies to ensure they're compliant. Although a number of policies are available by default, these can be extended by using plugins.

## Overview

GitProxy has several main components:

- HTTP Proxy Express app (`/src/proxy`): The actual proxy server for Git. Git operations performed by users are intercepted here, processed by various Express middleware (such as URL rewriting) and applies the relevant **chain** of actions to the payload. Customized functionality in the form of **plugins** are inserted and added to this chain as well. 
  - Chain: A set of **processors** that are applied to an action (i.e. a `git push` operation) before requesting review from a user with permission to approve pushes
  - Processor: AKA `Step`. A specific step in the chain where certain rules are applied. See the [list of default processors](#processors) below for more details.`
  - Plugin: A custom processor that can be added externally to extend GitProxy's default policies. See the [plugin guide](https://git-proxy.finos.org/docs/development/plugins) for more details.
- Service/API (`/src/service`): Handles UI requests, user authentication to GitProxy (not to Git), database operations and some of the logic for rejection/approval. Runs by default on port `8080`, and can be configured with the `GIT_PROXY_UI_HOST` and `GIT_PROXY_UI_PORT` environment variables.
  - Passport: The [library](https://www.passportjs.org/) used to authenticate to the GitProxy API (not the proxy itself - this depends on the Git `user.email`). Supports multiple authentication methods by default ([Local](#local), [AD](#activedirectory), [OIDC](#openid-connect)).
  - Routes: All the API endpoints used by the UI and proxy to perform operations and fetch or modify GitProxy's state. Except for custom plugin and processor development, there is no need for users or GitProxy administrators to interact with the API directly.
- Configuration (`/src/config`): Loads and validates the configuration from `proxy.config.json`, or any provided config file. Allows customising several aspects of GitProxy, including databases, authentication methods, predefined allowed repositories, commit blocking rules and more. For a full list of configurable parameters, check the [config file schema reference](https://git-proxy.finos.org/docs/configuration/reference/).
- Web UI, React (`/src/ui`): Allows user-friendly interactions with the application. Shows the list of pushes requiring approval, the list of repositories that users can contribute to, and more. Also allows users to easily review the changes in a push, and approve or reject it manually according to company policy.

## Diagram

These are all the core components in the project, along with some basic user interactions:

![GitProxy Architecture Diagram](./img/GitProxy_Architecture.png)

### Pushing to GitProxy

1. Alice (contributor) sets the GitProxy server as their Git remote
2. Alice commits and pushes something to the proxy remote
3. The Proxy module intercepts the request, and applies the Push Action Chain to process it
4. The push goes through each step in the chain and either gets rejected, or gets added to the list of pushes pending approval
5. Bob (admin/approver) reviews the push to ensure it complies with policy (attestation), and approves/rejects it
6. If approved, Alice can push once again to update the actual remote in the Git host. If rejected, the push will be marked as "rejected", and Alice must fix the conflicting commit/changes and push again for re-approval

### Approving/Rejecting a push

1. Alice makes a push
2. Bob (approver) logs into his GitProxy account through the UI
3. Bob sees the push on the dashboard, pending review
4. Bob can review the changes made (diff), commit messages and other push info
5. Before approving/rejecting, Bob must review the attestation (list of questions about company policy) and check all the boxes
6. Bob can approve the push, allowing Alice to push again (to the actual remote), or reject the push and optionally provide a reason for rejection

### Defining Policies

Three types of policies can be applied to incoming pushes:

- Default policies: These are already present in the GitProxy pull/push chain and require modifying source code to change their behaviour.
  - For example, [`checkUserPushPermission`](#checkuserpushpermission) which simply checks if the user's email exists in the GitProxy database, and if their user is marked in the "Contributors" list (`canPush`) for the repository they're trying to push to.
- Configurable policies: These are policies that can be easily configured through the GitProxy config (`proxy.config.json` or a custom file).
  - For example, [`checkCommitMessages`](#checkcommitmessages) which reads the configuration and matches the string patterns provided with the commit messages in the push in order to block it.
- Custom policies:
  - Plugins: Push/pull plugins provide more flexibility for implementing an organization's rules. For more information, see the [guide on writing your own plugins](https://git-proxy.finos.org/docs/development/plugins).
  - Processors: Custom logic may require specific data within a push that isn't available at the end of the chain (where plugins are executed). In this case, the appropriate solution is to write a processor and add it to the correct place in the chain.

## The nitty gritty

### Action Chains

Action chains are a list of processors that a Git operation goes through before awaiting approval. Three action chains are currently available:

#### Push action chain

Executed when a user makes a `git push` to GitProxy. These are the actions in `pushActionChain`, by order of execution:

- [`parsePush`](#parsepush)
- [`checkEmptyBranch`](#checkemptybranch)
- [`checkRepoInAuthorisedList`](#checkrepoinauthorisedlist)
- [`checkCommitMessages`](#checkcommitmessages)
- [`checkAuthorEmails`](#checkauthoremails)
- [`checkUserPushPermission`](#checkuserpushpermission)
- [`pullRemote`](#pullremote)
- [`writePack`](#writepack)
- [`checkHiddenCommits`](#checkhiddencommits)
- [`checkIfWaitingAuth`](#checkifwaitingauth)
- [`preReceive`](#prereceive)
- [`getDiff`](#getdiff)
- [`gitleaks`](#gitleaks)
- [`scanDiff`](#scandiff)
- [`blockForAuth`](#blockforauth)

#### Pull action chain

Executed when a user makes a `git clone` or `git pull` to GitProxy:

- [`checkRepoInAuthorisedList`](#checkrepoinauthorisedlist)
- 

At present the pull action chain is only checking that the repository is configured in Git Proxy, ensuring that it will block pull requests for unknown repositories.

#### Default action chain

This chain is executed when making any operation other than a `git push` or `git pull`.

- [`checkRepoInAuthorisedList`](#checkrepoinauthorisedlist)
- 

At present the default action chain is only checking that the repository is configured in Git Proxy, ensuring that it will block all git client requests for unknown repositories.

#### Finally

After processors in the chain are done executing, [`audit`](#audit) is called to store the action along with all of its execution steps in the database for auditing purposes. 

If [`pullRemote`](#pullremote) ran successfully and cloned the repository, then [`clearBareClone`](#clearbareclone) is run to clear up that clone, freeing disk space and ensuring that the _.remote/*_ folder created does not conflict with any future pushes involving the same SHA.

Finally, if the action was auto-approved or auto-rejected as a result of running [`preReceive`](#prereceive), it will attempt to auto-approve or auto-reject it.

### Processors

Processors (also known as push/pull actions) represent operations that each push or pull must go through in order to get approved or rejected.

Processors do not necessarily represent policies. Some processors are just operations that help fetch or process data: For example, [`pullRemote`](#pullremote) simply clones the remote repository from the Git host.

#### `checkRepoInAuthorisedList`

Checks if the URL of the repo being pushed to is present in the GitProxy repo database. If no repo URL in the database matches, the push is blocked.

Source: [/src/proxy/processors/push-action/checkRepoInAuthorisedList.ts](/src/proxy/processors/push-action/checkRepoInAuthorisedList.ts)

#### `parsePush`

Parses the push request data which comes from the Git client as a buffer that contains packet line data. If anything unexpected happens during parsing, such as malformed pack data or multiple ref updates in a single push, the push will get rejected.

Also handles extraction of push contents, such as the details of the individual commits contained in the push and the details of `committer` (the user attempting to push the commits through the proxy).

Source: [/src/proxy/processors/push-action/parsePush.ts](/src/proxy/processors/push-action/parsePush.ts)

#### `checkEmptyBranch`

Checks if the push contains any commit data, or is just an empty branch push (pushing a new branch without any additional commits). Empty branch pushes are blocked because subsequent processors require commit data to work correctly.

Source: [/src/proxy/processors/push-action/checkEmptyBranch.ts](/src/proxy/processors/push-action/checkEmptyBranch.ts)

#### `checkCommitMessages`

A **configurable** processor that blocks pushes containing commit messages that match the provided literals or patterns. These patterns can be configured in the `commitConfig.message` entry in `proxy.config.json` or the active configuration file:

```json
"commitConfig": {
  "author": {
    "email": {
      "local": {
        "block": ""
      },
      "domain": {
        "allow": ".*"
      }
    }
  },
  "message": {
    "block": {
      "literals": [],
      "patterns": []
    }
  },
  "diff": {
    "block": {
      "literals": [],
      "patterns": [],
      "providers": {}
    }
  }
},
```

If the arrays are empty, the checks will pass and chain execution will continue.

Note that invalid regex patterns will also fail the `isMessageAllowed` check.

Source: [/src/proxy/processors/push-action/checkCommitMessages.ts](/src/proxy/processors/push-action/checkCommitMessages.ts)

#### `checkAuthorEmails`

Similar to [`checkCommitMessages`](#checkcommitmessages), allows configuring allowed domains or blocked "locals" (the part before "@domain.com"). If any commit(s) author email(s) match the `local.block` regex, the push gets blocked. Likewise, if any of the emails' domains does not match the `domain.allow` regex, the push gets blocked.

If neither of these are configured (set to empty strings), then the checks will pass and chain execution will continue.

Note that this processor will also fail on invalid regex in the configuration.

Source: [/src/proxy/processors/push-action/checkAuthorEmails.ts](/src/proxy/processors/push-action/checkAuthorEmails.ts)

#### `checkUserPushPermission`

Checks if the push has an valid user email associated to it, and if that user is allowed to push to that specific repo.

This step will fail on various scenarios such as:

- Push has no email associated to it (potentially a push parsing error)
- The email associated to the push matches multiple GitProxy users
- The user with the given email isn't in the repo's contributor list (`canPush`)

Source: [/src/proxy/processors/push-action/checkUserPushPermission.ts](/src/proxy/processors/push-action/checkUserPushPermission.ts)

#### `pullRemote`

Clones the repository and temporarily stores it locally in a subdirectory of the _.remote_ folder in the deployment. Each clone is named using the base and head SHA of the push, ensuring a unique clone for each different push. The path to the subdirectory is set in the action as the `proxyGitPath` property and is used in subsequent steps.

For private repos, `pullRemote` uses the authorization headers from the push and uses them to authenticate the `git clone` operation.

In the event that the clone fails, pullRemote will automatically delete the _.remote/*_ directory that it created - unless that failure was caused by a concurrent request for the same push (so that the earlier request can complete if it is going to). 

If the clone succeeds then the chain will schedule deletion of the clone by [`clearBareClone`](#clearbareclone) after processing of the chain completes. This ensures that disk space used is recovered, subsequent pushes of the same SHA don't conflict and that user credentials cached in the git clone are removed.

Source: [/src/proxy/processors/push-action/pullRemote.ts](/src/proxy/processors/push-action/pullRemote.ts)

#### `writePack`

Executes `git receive-pack` with the incoming pack data from the request body in order to receive the pushed data. It also identifies new `.idx` files in `.git/objects/pack` for other processors (such as [`checkHiddenCommits`](#checkhiddencommits)) to scan more efficiently.

Note that `writePack` sets Git's `receive.unpackLimit` to `0`, which forces Git to always create pack files instead of unpacking objects individually.

Source: [/src/proxy/processors/push-action/writePack.ts](/src/proxy/processors/push-action/writePack.ts)

#### `checkHiddenCommits`

Detects "hidden" commits in a push, which is possible if the pack file in the push was tampered in some way.

It calls `git verify-pack` on each of the new `.idx` files found in [`writePack`](#writepack). If any unreferenced commits are present, the push is blocked.

Source: [/src/proxy/processors/push-action/checkHiddenCommits.ts](/src/proxy/processors/push-action/checkHiddenCommits.ts)

#### `checkIfWaitingAuth`

Checks if the action has been authorised (approved by a reviewer). If so, allows the push to continue to the remote. It simply continues chain execution if the push hasn't been approved.

Source: [/src/proxy/processors/push-action/checkIfWaitingAuth.ts](/src/proxy/processors/push-action/checkIfWaitingAuth.ts)

#### `preReceive`

Allows executing pre-receive hooks from `.sh` scripts located in the `./hooks` directory. **Also allows automating the approval process.** This enables admins to reuse GitHub enterprise commit policies and provide a seamless experience for contributors who no longer need to wait for manual approval or be aware of GitProxy intercepting their pushes.

Pre-receive hooks are a feature that allows blocking or automatically approving commits based on rules described in `.sh` scripts. GitHub provides a set of [sample rules](https://github.com/github/platform-samples/blob/master/pre-receive-hooks) to get started.

**Important**: The pre-receive hook does not bypass the other processors in the chain. All processors continue to execute normally, and any of them can still block the push. The pre-receive hook only determines whether the push will be auto-approved, auto-rejected, or require manual review after all processors have completed.

This processor will block the push depending on the exit status of the pre-receive hook:

- Exit status `0`: Sets the push to `autoApproved`. If no other processors block the push, the contributor can immediately push again to the upstream repository without waiting for manual approval.
- Exit status `1`: Sets the push to `autoRejected`, automatically rejecting the push after the chain completes, regardless of whether the other processors would have allowed it.
- Exit status `2`: Requires subsequent manual approval as any regular push, even if all processors succeed.

For detailed setup instructions and examples, see the [Pre-Receive Hook configuration guide](https://git-proxy.finos.org/docs/configuration/pre-receive/).

Source: [/src/proxy/processors/push-action/preReceive.ts](/src/proxy/processors/push-action/preReceive.ts)

#### `getDiff`

Executes `git diff` to obtain the diff for the given revision range. If the commit data is empty or has no entries (possible due to a malformed push), the push is blocked.

The data extracted in this step is later used in [`scanDiff`](#scandiff).

Source: [/src/proxy/processors/push-action/getDiff.ts](/src/proxy/processors/push-action/getDiff.ts)

#### `gitleaks`

Runs [Gitleaks](https://github.com/gitleaks/gitleaks) to detect sensitive information such as API keys and passwords in the commits being pushed to prevent credentials from leaking.

The following parameters can be configured:

- `enabled`: Whether scanning is active. `false` by default
- `ignoreGitleaksAllow`: Forces scanning even if developers added `gitleaks:allow` comments
- `noColor`: Controls color output formatting
- `configPath`: Sets a custom Gitleaks rules file

This processor runs the Gitleaks check starting from the root commit to the `commitFrom` value present in the push. If the Gitleaks check fails (nonzero exit code), or otherwise cannot spawn, the push will be blocked.

Source: [/src/proxy/processors/push-action/gitleaks.ts](/src/proxy/processors/push-action/gitleaks.ts)

#### `clearBareClone`

Recursively removes the contents of `./.remote`, which is the location where the bare repository is cloned in [`pullRemote`](#pullremote). This exists for various reasons:

- Security (isolating credentials):
  - Since repositories require `username` and `password` on clone, these variables must be removed to prevent leaking between requests.
- Managing disk space:
  - Without deletion, `./.remote` would grow indefinitely as new repositories are added/proxied
  - Each action gets a unique directory for isolation in [`pullRemote`](#pullremote), which is then deleted in `clearBareClone`
- Multiuser support:
  - Manage access to different repositories for multiple users
  - Prevent one user from accessing another user's cached session data

Recursively removes the contents of the (modified) repository clone stored in `./.remote` by [`pullRemote`](#pullremote) and indivated by the `proxyGitPath` property of the `Action`. This clean-up is necessary for:
 
- Security (cached credentials):
  - Since repositories require a git username and password or personal access token (PAT) on clone and these are cached in the clone, they must be removed to prevent leakage.
- Managing disk space:
  - Without deletion, `./.remote` would grow indefinitely as new repository clones are added for each push (rather than each repository!)
  - Each action gets a unique directory for isolation in [`pullRemote`](#pullremote), which allows pushes to the same repository for multiple users to be processed concurrently without conflicts or confusion over credentials. 

Source: [/src/proxy/processors/push-action/clearBareClone.ts](/src/proxy/processors/post-processor/clearBareClone.ts)

#### `scanDiff`

A **configurable** processor that blocks pushes containing diff (changes) that match the provided literals or patterns. These patterns can be configured in the `commitConfig.diff` entry in `proxy.config.json` or the active configuration file:

```json
"commitConfig": {
  "author": {
    "email": {
      "local": {
        "block": ""
      },
      "domain": {
        "allow": ".*"
      }
    }
  },
  "message": {
    "block": {
      "literals": [],
      "patterns": []
    }
  },
  "diff": {
    "block": {
      "literals": [],
      "patterns": [],
      "providers": {}
    }
  }
},
```

This will scan every file changed and try to match the configured literals, patterns or providers. If any diff violations are found, the push is blocked.

Note that this processor will fail if the configured regex patterns are invalid.

Source: [/src/proxy/processors/push-action/scanDiff.ts](/src/proxy/processors/push-action/scanDiff.ts)

#### `blockForAuth`

This action appends a message to be displayed after all the processors have finished on a pre-approval push.

Note that this message will show again even if the push had been previously rejected by a reviewer or cancelled and resubmitted by the committer. After a manual rejection, pushing again creates a new `action` object so that the push can be re-reviewed and approved.

![blockForAuth output](./img/blockForAuth_output.png)

Source: [/src/proxy/processors/push-action/blockForAuth.ts](/src/proxy/processors/push-action/blockForAuth.ts)

#### `audit`

This action is executed after a chain has been executed. It stores in the database the entire `Action` object along with the list of `steps` that the action has gone through and their associated logs or error messages that occurred during processing of the chaind.

Note: **`audit` does not write pull actions** to the DB.

An action object (or entry in the pushes table) might look like this:

```json
{
  "steps": [
    {
      "logs": [
        "checkRepoInAuthorisedList - repo https://github.com/finos/git-proxy.git is in the authorisedList"
      ],
      "id": "73d47899-b1f8-45f0-9fd5-ef2535a07bbd",
      "stepName": "checkRepoInAuthorisedList",
      "content": null,
      "error": false,
      "errorMessage": null,
      "blocked": false,
      "blockedMessage": null
    }
  ],
  "error": false,
  "blocked": false,
  "allowPush": false,
  "authorised": false,
  "canceled": false,
  "rejected": false,
  "autoApproved": false,
  "autoRejected": false,
  "commitData": [],
  "id": "1763522405484",
  "type": "default",
  "method": "GET",
  "timestamp": 1763522405484,
  "url": "https://github.com/finos/git-proxy.git",
  "repo": "https://github.com/finos/git-proxy.git",
  "project": "finos",
  "repoName": "git-proxy.git",
  "lastStep": {
    "logs": [
      "checkRepoInAuthorisedList - repo https://github.com/finos/git-proxy.git is in the authorisedList"
    ],
    "id": "73d47899-b1f8-45f0-9fd5-ef2535a07bbd",
    "stepName": "checkRepoInAuthorisedList",
    "content": null,
    "error": false,
    "errorMessage": null,
    "blocked": false,
    "blockedMessage": null
  },
  "_id": "h69TOxN1AMsxd0xr"
}
```

### Authentication

Currently, three different authentication methods are provided for interacting with the UI and adding users. This can be configured by editing the `authentication` array in `proxy.config.json`.

#### Local

Default username/password auth method. Note that this authentication method does not allow adding users directly from the UI (`/api/auth/create-user` must be used instead).

Default accounts are provided for testing:

- Admin: Username: `admin`, Password: `admin`
- User: Username: `user`, Password: `user`

#### ActiveDirectory

Allows AD authentication and user management. The following parameters must be configured in `proxy.config.json`, and `enabled` must be set to `true`:

```json
{
  "type": "ActiveDirectory",
  "enabled": false,
  "adminGroup": "",
  "userGroup": "",
  "domain": "",
  "adConfig": {
    "url": "",
    "baseDN": "",
    "searchBase": "",
    "username": "",
    "password": ""
  }
}
```

#### OpenID Connect

Allows authenticating to OIDC. The following parameters must be configured in `proxy.config.json`, and `enabled` must be set to `true`:

```json
{
  "type": "openidconnect",
  "enabled": false,
  "oidcConfig": {
    "issuer": "",
    "clientID": "",
    "clientSecret": "",
    "callbackURL": "",
    "scope": ""
  }
}
```

When logging in for the first time, this will create a GitProxy user with the same email associated to the OIDC provider. The username will be set to the local portion of the email.

For example: logging in with myusername@mymail.com will create a new user with username set to `myusername`.

#### Adding new methods

New methods can be added by:

1. Extending `/src/service/passport` with the relevant [passport.js strategy](https://www.passportjs.org/packages/).
   - The strategy file must have a `configure` method and a `type` string to match with the config method. See the pre-existing methods in [`/src/service/passport`](/src/service/passport) for more details.
2. Creating a `proxy.config.json` entry with the required configuration parameters
3. Importing the new strategy and adding it to the `authStrategies` array in `/src/service/passport/index.ts`

### GitProxy Configuration

Many of the proxy, API and UI behaviours are configurable. The most important ones will be covered here. For a comprehensive list of parameters, see the [config file schema reference](https://git-proxy.finos.org/docs/configuration/reference/).

GitProxy ships with a default configuration which can be customised in various ways. See the [configuration guide](https://git-proxy.finos.org/docs/configuration/overview) for more details on providing custom config files and validating them.

### Config parameters

#### `cookieSecret`

This is the secret that is passed in to `express-session` for signing the session ID cookie for the **GitProxy API Express app** (not the proxy itself).

As per their documentation:

> This is the secret used to sign the session ID cookie. The secret can be any type of value that is supported by Node.js `crypto.createHmac` (like a string or a Buffer). This can be either a single secret, or an array of multiple secrets. If an array of secrets is provided, only the first element will be used to sign the session ID cookie, while all the elements will be considered when verifying the signature in requests. The secret itself should be not easily parsed by a human and would best be a random set of characters.
>
> A best practice may include:
>
> - The use of environment variables to store the secret, ensuring the secret itself does not exist in your repository.
> - Periodic updates of the secret, while ensuring the previous secret is in the array.
>
> Using a secret that cannot be guessed will reduce the ability to hijack a session to only guessing the session ID (as determined by the `genid` option).
>
> Changing the secret value will invalidate all existing sessions.
> In order to rotate the secret without invalidating sessions, provide an array of secrets, with the new secret as first element of the array, and including previous secrets as the later elements.
>
> Note HMAC-256 is used to sign the session ID. For this reason, the secret should contain at least 32 bytes of entropy.

#### `sessionMaxAgeHours`

Specifies the number of hours to use when calculating the `Expires Set-Cookie` attribute **for the GitProxy API** (not the proxy itself).

Default: `12`

#### `api`

Allows defining and configuring third-party APIs.

Currently supports the following out-of-the-box:

- ActiveDirectory auth configuration for querying via a REST API rather than LDAP
- Gitleaks configuration

#### `commitConfig`

Used in [`checkCommitMessages`](#checkcommitmessages), [`checkAuthorEmails`](#checkauthoremails) and [`scanDiff`](#scandiff) processors to block pushes depending on the given rules.

By default, no rules are applied.

These are some sample values for allowing commits associated to one's own company/organization, and blocking commits containing sensitive information such as AWS tokens or SSH private keys:

```json
"commitConfig": {
  "author": {
    "email": {
      "local": {
        "block": "(test|noreply|do-not-reply)"
      },
      "domain": {
        "allow": "(mycompany\\.com|myorg\\.io)$"
      }
    }
  },
  "message": {
    "block": {
      "literals": [
        "password",
        "secret",
        "TODO",
      ],
      "patterns": [
        "AKIA[0-9A-Z]{16}",
        "postgresql://[^\\s]+:[^\\s]+@",
        "mongodb://[^\\s]+:[^\\s]+@",
      ]
    }
  },
  "diff": {
    "block": {
      "literals": [
        "DEBUG_MODE=true",
        "-----BEGIN PRIVATE KEY-----",
        "-----BEGIN RSA PRIVATE KEY-----"
      ],
      "patterns": [
        "AKIA[0-9A-Z]{16}",
      ],
      "providers": {
        "AWS Access Key": "AKIA[0-9A-Z]{16}",
        "GitHub Token": "ghp_[a-zA-Z0-9]{36}",
        "Google API Key": "AIza[0-9A-Za-z\\-_]{35}",
        "JWT Token": "eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*",
        "Private Key Pattern": "-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"
      }
    }
  }
}
```

#### `attestationConfig`

Allows configuring the attestation form displayed to reviewers. Reviewers must check each box to complete the review.

Has a list of `questions`, each of which can be configured with a `label` and a `tooltip` with various `links`:

```json
"attestationConfig": {
  "questions": [
    {
      "label": "I am happy for this to be pushed to the upstream repository",
      "tooltip": {
        "text": "Are you happy for this contribution to be pushed upstream?",
        "links": []
      }
    },
    {
      "label": "I have read and agree to the Code of Conduct",
      "tooltip": {
        "text": "Please read the Code of Conduct before approving this contribution.",
        "links": [{
          "text": "Code of Conduct",
          "url": "https://www.finos.org/code-of-conduct"
        }]
      }
    }
  ]
}
```

Given the previous configuration, the attestation prompt would look like this:

![Attestation Prompt](./img/attestation_example.png)

#### `domains`

Allows setting custom URLs for GitProxy interfaces in case these cannot be determined.

This parameter is used in [`/src/service/urls.ts`](/src/service/urls.ts) to override URLs for the proxy (default: http://localhost:8000) and service (default: http://localhost:8080).

Sample configuration:

```json
"domains": {
  "proxy": "https://git-proxy.mydomain.com",
  "service": "https://git-proxy-api.mydomain.com"
}
```

#### `rateLimit`

Defines the rate limiting parameters (via [express-rate-limit](https://www.npmjs.com/package/express-rate-limit)) for the GitProxy API (not the proxy).

Sample values:

```json
"rateLimit": {
  "windowMs": 60000,
  "limit": 150
}
```

This will limit the number of **requests made to the API** to 150 per minute.

Optionally, a `statusCode` and a `message` can be specified to override the default responses.

#### `privateOrganizations` (deprecated)

Formerly used to block organizations, replaced by `commitConfig.diff.block.providers`.

#### `urlShortener`

Currently unused.

#### `contactEmail`

Sets the contact email for the Open Source Program Office (or equivalent organisational contact) in the attestation form:

![Attestation Form](./img/attestation_example.png)

#### `csrfProtection`

Enables [lusca](https://github.com/krakenjs/lusca) (Cross-Site Request Forgery protection) for the API. This prevents third-party services from making requests to the API without proper CSRF token handling.

For example, the Cypress UI tests need to call `getCSRFToken` before making requests:

```js
Cypress.Commands.add('getCSRFToken', () => {
  return cy.request('GET', 'http://localhost:8080/api/v1/repo').then((res) => {
    let cookies = res.headers['set-cookie'];

    if (typeof cookies === 'string') {
      cookies = [cookies];
    }

    if (!cookies) {
      throw new Error('No cookies found in response');
    }

    const csrfCookie = cookies.find((c) => c.startsWith('csrf='));
    if (!csrfCookie) {
      throw new Error('No CSRF cookie found in response headers');
    }

    const token = csrfCookie.split('=')[1].split(';')[0];
    return cy.wrap(decodeURIComponent(token));
  });
});
```

#### `plugins`

Defines a list of plugins to integrate on GitProxy's push or pull actions. Accepted values are either a file path or a module name.

See the [plugin guide](https://git-proxy.finos.org/docs/development/plugins) for more setup details.

#### `authorisedList`

Defines a initial list of repositories that are allowed to be pushed to through the proxy. Note that **repositories can also be added through the UI, API or by manually editing the database**.

Sample values:

```json
"authorisedList": [
  {
    "project": "my-organization",
    "name": "my-repo",
    "url": "https://github.com/my-organization/my-repo.git",
  }
]
```

#### `sink`

List of database sources. The first source with `enabled` set to `true` will be used. Currently, MongoDB and filesystem databases ([NeDB](https://www.npmjs.com/package/@seald-io/nedb)) are supported. By default, the filesystem database is used.

Each entry has its own unique configuration parameters.

Extending GitProxy to support other databases requires adding the relevant handlers and setup to the [`/src/db`](/src/db/) directory. Feel free to [open an issue](https://github.com/finos/git-proxy/issues) requesting support for any specific databases - or [open a PR](https://github.com/finos/git-proxy/pulls) with the desired changes!

#### `authentication`

List of authentication methods. See the [authentication](#authentication) section for more details.

#### `tempPassword`

Currently unused.

#### `apiAuthentication`

Allows defining ways to authenticate to the API. This is useful for securing custom/automated solutions that rely on the GitProxy API, as well as adding an extra layer of security for the UI.

If `apiAuthentication` is left empty, API endpoints will be publicly accesible.

Currently, only JWT auth is supported. This is implemented via the [`jwtAuthHandler` middleware](/src/service/passport/jwtAuthHandler.ts). Aside of validating incoming access tokens, it can also assign roles based on the token payload.

##### Setting up JWT Authentication

When JWT authentication is enabled, all incoming requests must provide a valid JWT access token in the UI. This can be set in the settings tab.

If no token, or an invalid/expired token is sent, requests will fail with a `401` Unauthorized response.

The JWT auth configuration looks like this:

```json
{
  "type": "jwt",
  "enabled": true,
  "jwtConfig": {
    "authorityURL": "https://accounts.google.com",
    "clientID": "my-client-id.apps.googleusercontent.com",
    "expectedAudience": "https://accounts.google.com",
    "roleMapping": {
      "admin": {
        "name": "John Doe"
      }
    }
  }
}
```

`authorityURL` must point to an OIDC issuer. This URL is used to fetch signing keys and to verify the token’s issuer. If this value is missing, the server will return a 500 error.

`clientID` is required and used for token validation. If not configured, requests will fail with a server error.

`expectedAudience` defines which audience (aud claim) the token must contain. When not explicitly set, the middleware falls back to using the `clientID` as expected audience. Tokens issued for a different audience will be rejected, even if they are otherwise valid.

If the JWT cannot be verified, is expired, or doesn't match the expected issuer or audience, the API responds with `401 Unauthorized`.

##### Role Mapping

After a token is successfully validated, role assignment is done based on `roleMapping`. The decoded JWT payload is matched against these rules. Roles will be assigned when a key-value pair in the claims matches the ones in the configuration. These roles are then assigned to the `Request.user` value.

For example, to assign `req.admin` to users whose name matches "John Doe":

```json
"roleMapping": {
  "admin": {
    "name": "John Doe",
  }
}
```

##### Errors

If JWT authentication is enabled, requests may fail for various reasons, including:

- Missing JWT token (must set token in UI Settings page)
- Invalid or expired token
- Mismatched issuer or audience
- Missing required configuration in `proxy.config.json`

To solve most of these, check that GitProxy's JWT configuration is correct, and that the user has set a valid JWT in the UI Settings page.

#### `tls`

Allows configuring TLS (Transport Layer Security) **for the proxy** (not for the API):

```json
"tls": {
  "enabled": true,
  "key": "certs/key.pem",
  "cert": "certs/cert.pem"
}
```

#### `configurationSources`

Allows setting custom sources for configuring GitProxy. Configuration can be customised through files, HTTP or Git servers.

Furthermore, configuration can be reloaded periodically or merged from multiple sources.

Sample values:

```json
"configurationSources": {
  "enabled": true,
  "reloadIntervalSeconds": 60,
  "merge": true,
  "sources": [
    {
      "type": "file",
      "enabled": true,
      "path": "./external-config.json"
    },
    {
      "type": "http",
      "enabled": true,
      "url": "http://config-service.com/git-proxy-config",
      "headers": {},
      "auth": {
        "type": "bearer",
        "token": ""
      }
    },
    {
      "type": "git",
      "enabled": true,
      "repository": "https://git-server.com/project/git-proxy-config",
      "branch": "main",
      "path": "git-proxy/config.json",
      "auth": {
        "type": "ssh",
        "privateKeyPath": "/path/to/.ssh/id_rsa"
      }
    }
  ]
},
```

#### `uiRouteAuth`

Allows defining which UI routes require authentication to access. Rules are set through URL patterns, and can be set to require a logged-in user or an admin to access.

If the default values are set to `enabled: true`, any routes matching `/dashboard/*` will require login, and any routes matching `/admin/*` will require a logged-in admin user:

```json
"uiRouteAuth": {
  "enabled": true,
  "rules": [
    {
      "pattern": "/dashboard/*",
      "adminOnly": false,
      "loginRequired": true
    },
    {
      "pattern": "/admin/*",
      "adminOnly": true,
      "loginRequired": true
    }
  ]
}
```

When the constraints are not met, the user will be redirected to the login page or a 401 Unauthorized page will be shown.

## Suggestions?

If you have suggestions to improve this guide or fill in missing details, feel free to [raise an issue](https://github.com/finos/git-proxy/issues/new?template=feature_request.md) or open a PR with the desired changes.
