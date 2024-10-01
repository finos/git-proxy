<br />
<div align="center">
  <a href="https://github.com/finos/git-proxy">
    <img src="./docs/img/logo.png" alt="Logo" height="95">
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=a51b8999-4347-442c-bc98-bfcc380ee280" />
  </a>

  <br />
  <br />

  <p align="center">
    Deploy custom push protections and policies<br />on top of Git
    <br />
    <br />
    <br />
    <a href="https://git-proxy.finos.org">Docs</a>
    ·
    <a href="https://www.finos.org/hubfs/Projects%20%2B%20SIGs/Open%20Source%20Readiness%20OSR/OSR%20Meeting_%20GitProxy%20Jamie%20Slome%20Citi%20Presentation.mp4#t=496">Demo</a>
    ·
    <a href="https://github.com/finos/git-proxy/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=">Report a bug</a>
    ·
    <a href="https://github.com/finos/git-proxy/issues/new?assignees=&labels=&projects=&template=feature_request.md&title=">Suggest a new feature</a>
  </p>

  <br />

[![FINOS - Incubating](https://cdn.jsdelivr.net/gh/finos/contrib-toolbox@master/images/badge-incubating.svg)](https://community.finos.org/docs/governance/Software-Projects/stages/incubating)
[![NPM](https://img.shields.io/npm/v/@finos/git-proxy?colorA=00C586&colorB=000000)](https://www.npmjs.com/package/@finos/git-proxy)
[![Build](https://img.shields.io/github/actions/workflow/status/finos/git-proxy/ci.yml?branch=main&label=CI&logo=github&colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/finos/git-proxy/branch/main/graph/badge.svg)](https://codecov.io/gh/finos/git-proxy)
[![git-proxy](https://api.securityscorecards.dev/projects/github.com/finos/git-proxy/badge)](https://api.securityscorecards.dev/projects/github.com/finos/git-proxy)
[![Documentation](https://img.shields.io/badge/_-documentation-000000?colorA=00C586&logo=docusaurus&logoColor=FFFFFF&)](https://git-proxy.finos.org)
<br />
[![License](https://img.shields.io/github/license/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/blob/main/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/graphs/contributors)
[![Slack](https://img.shields.io/badge/_-Chat_on_Slack-000000.svg?logo=slack&colorA=00C586)](https://app.slack.com/client/T01E7QRQH97/C06LXNW0W76)
[![Stars](https://img.shields.io/github/stars/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/stargazers)
[![Forks](https://img.shields.io/github/forks/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/forks)

</div>
<br />

## What is GitProxy

GitProxy is an application that stands between developers and a Git remote endpoint (e.g., `github.com`). It applies rules and workflows (configurable as `plugins`) to all outgoing `git push` operations to ensure they are compliant.

The main goal of GitProxy is to marry the defacto standard Open Source developer experience (git-based workflow of branching out, submitting changes and merging back) with security and legal requirements that firms have to comply with, when operating in highly regulated industries like financial services.

That said, GitProxy can also be used on a local environment to enforce a single developer's best practices, which tends to be the easiest setup to start with and the most comfortable one to build new GitProxy plugins.

```mermaid
sequenceDiagram
    actor Developer
    Developer->>+Git Server: git clone
    Developer->>Workstation: git remote add proxy <proxy-server>
    Developer->>+GitProxy: git push proxy
    GitProxy-->>-Developer: Failed license check
    Developer->>Workstation: git commit -m 'fix license issue'
    Developer->>+GitProxy: git push
    GitProxy-->>-Git Server: Approved
```

## Getting Started 🚀

Install & run git-proxy (requires [Nodejs](https://nodejs.org/en/download/)):

```bash
$ npx -- @finos/git-proxy
```

Clone a repository, set the remote to the GitProxy URL and push your changes:

```bash
# Only HTTPS cloning is supported at the moment, see https://github.com/finos/git-proxy/issues/27.
$ git clone https://github.com/octocat/Hello-World.git && cd Hello-World
# The below command is using the GitHub official CLI to fork the repo that is cloned.
# You can also fork on the GitHub UI. For usage details on the CLI, see https://github.com/cli/cli
$ gh repo fork
✓ Created fork yourGithubUser/Hello-World
...
$ git remote add proxy http://localhost:8000/yourGithubUser/Hello-World.git
# This fetches the repository's default branch and pushes it (https://stackoverflow.com/a/44750379).
$ git push proxy $(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
```

Using the default configuration, GitProxy intercepts the push and _blocks_ it. To enable code pushing to your fork via GitProxy, add your repository URL into the GitProxy config file (`proxy.config.json`). For more information, refer to [our documentation](https://git-proxy.finos.org).

## Documentation
For detailed step-by-step instructions for how to install, deploy & configure GitProxy and
customize for your environment, see the [project's documentation](https://git-proxy.finos.org/docs/):

- [Quickstart](https://git-proxy.finos.org/docs/category/quickstart/)
- [Installation](https://git-proxy.finos.org/docs/installation)
- [Configuration](https://git-proxy.finos.org/docs/category/configuration)

## Contributing

Your contributions are at the core of making this a true open source project. Any contributions you make are **greatly appreciated**. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for more information.

## Security

If you identify a security vulnerability in the codebase, please follow the steps in [`SECURITY.md`](https://github.com/finos/git-proxy/security/policy). This includes logic-based vulnerabilities and sensitive information or secrets found in code.

## Code of Conduct

We are committed to making open source an enjoyable and respectful experience for our community. See <a href="https://github.com/finos/git-proxy/blob/main/CODE_OF_CONDUCT.md"><code>CODE_OF_CONDUCT</code></a> for more information.

## License

This project is distributed under the Apache-2.0 license. See <a href="./LICENSE"><code>LICENSE</code></a> for more information.

## Contact

Drop a note, ask a question or just say hello in our [community Slack channel](https://app.slack.com/client/T01E7QRQH97/C06LXNW0W76) 👋

If you can't access Slack, you can also [subscribe to our mailing list](mailto:git-proxy+subscribe@lists.finos.org).

Join our [fortnightly Zoom meeting](https://zoom.us/j/97235277537?pwd=aDJsaE8zcDJpYW1vZHJmSTJ0RXNZUT09) on Monday, 11AM EST (odd week numbers). Send an e-mail to [help@finos.org](mailto:help@finos.org) to get a calendar invitation.

Otherwise, if you have a deeper query or require more support, please [raise an issue](https://github.com/finos/git-proxy/issues). 
