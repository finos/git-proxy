# GitProxy Architecture

This guide explains GitProxy's various components GitProxy, and how they communicate with each other when performing a `git push`.

As mentioned in [the README](/README.md), GitProxy is an application that intercepts pushes and applies rules/policies to ensure they're compliant. Although a number of policies are available by default, these can be extended by using plugins.

## Overview

GitProxy has several main components:

- Proxy (`/src/proxy`): The actual proxy for Git. Git operations performed by users are intercepted here to apply the relevant **chain**. Also loads **plugins** and adds them to the chain. Runs by default on port `8000`.
  - Chain: A set of **processors** that are applied to an action (i.e. a `git push` operation) before requesting review from an approved user
  - Processor: AKA `Step`. A specific step in the chain where certain rules are applied. See the list of default processors below for more details.`
  <!-- Todo: link to processor list -->
  - Plugin: A custom processor that can be added externally to extend GitProxy's default policies. See the plugin guide for more details.
  <!-- Todo: Add link to plugin guide -->
- Service/API (`/src/service`): Handles UI requests, user authentication to GitProxy (not to Git), database operations and some of the logic for rejection/approval. Runs by default on port `8080`.
  - Passport: The library used to authenticate to the GitProxy API (not the proxy itself - this depends on the Git `user.email`). Supports multiple authentication methods by default (Local, AD, OIDC).
  <!-- Todo: Link to supported methods -->
  - Routes: All the API endpoints used by the UI and proxy to perform operations and fetch or modify GitProxy's state. Except for custom application development, there is no need for users or GitProxy administrators to interact with the API directly.
- Configuration (`/src/config`): Loads and validates the configuration from `proxy.config.json`, or any provided config file. Allows customising several aspects of GitProxy, including databases, authentication methods, predefined allowed repositories, commit blocking rules and more. For a full list of configurable parameters, check the [config file schema reference](https://git-proxy.finos.org/docs/configuration/reference/).
- UI (`/src/ui`): Allows user-friendly interactions with the application. Shows the list of pushes requiring approval, the list of repositories that users can contribute to, and more. Also allows users to easily review the changes in a push, and approve or reject it manually according to company policy.

## Diagram

These are all the core components in the project, along with some basic user interactions:

![GitProxy Architecture Diagram](./img/architecture.png)

### Pushing to GitProxy

1. Alice (contributor) sets the GitProxy server as their Git remote
2. Alice commits and pushes something to the proxy
3. The Proxy module intercepts the request, and applies the Push Action Chain to process it
4. The push goes through each step in the chain and either gets rejected, or gets added to the list of pushes pending approval
5. Bob (admin/approver) reviews the push to ensure it complies with policy (Attestation), and approves/rejects it
6. If approved, Alice can push once again to update the actual remote in the Git Host. If rejected, the push will be marked as "rejected", and Alice must update the PR and push again for re-approval

### Approving/Rejecting a push

1. Alice makes a push
2. Bob (approver) logs into his GitProxy account through the UI
3. Bob sees the push on the dashboard, pending review
4. Bob can review the changes made (diff), commit messages and other push info
5. Before approving/rejecting, Bob must review the attestation (list of questions about company policy)
6. Bob can approve the push, allowing Alice to push again (to the actual remote), or reject the push and optionally provide a reason for rejection

### Defining Policies

Three types of policies can be applied to incoming pushes:

- Default policies: These are already present in the GitProxy pull/push chain and require modifying source code to change their behaviour.
  - For example, `checkUserPushPermission` which simply checks if the user's email exists in the GitProxy database, and if their user is marked in the "Contributors" list (`canPush`) for the repository they're trying to push to.
- Configurable policies: These are policies that can be easily configured through the GitProxy config (`proxy.config.json`).
  - For example, `checkCommitMessages` which reads the configuration and matches the string patterns provided with the commit messages in the push in order to block it.
- Custom policies (Plugins): Writing your own Push/Pull plugins provides more flexibility for implementing an organization's rules. For more information, see the guide on writing plugins.
<!-- Todo: add link to plugin guide -->
