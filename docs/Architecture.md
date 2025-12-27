# GitProxy Architecture

This guide explains GitProxy's various components GitProxy, and how they communicate with each other when performing a `git push`.

As mentioned in [the README](/README.md), GitProxy is an application that intercepts pushes and applies rules/policies to ensure they're compliant. Although a number of policies are available by default, these can be extended by using plugins.

## Overview

GitProxy has several main components:

- Proxy (`/src/proxy`): The actual proxy for Git. Git operations performed by users are intercepted here to apply the relevant **chain**. Also loads **plugins** and adds them to the chain. Runs by default on port `8000`.
  - Chain: A set of **processors** that are applied to an action (i.e. a `git push` operation) before requesting review from an approved user
  - Processor: AKA `Step`. A specific step in the chain where certain rules are applied. See the list of default processors below for more details.`
  <!-- Todo: link to processor list -->
  - Plugin: A custom processor that can be easily added externally to extend GitProxy's default policies. See the plugin guide for more details.
  <!-- Todo: Add link to plugin guide -->
- Service/API (`/src/service`): Handles UI requests, user authentication to GitProxy (not to Git), database operations and some of the logic for rejection/approval. Runs by default on port `8080`.
- UI (`/src/ui`): Allows user-friendly interactions with the application. Shows the list of pushes requiring approval, the list of repositories that users can contribute to, and more. Also allows users to easily review the changes in the push, and approve or reject it manually according to company policy.
