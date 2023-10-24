<br />
<div align="center">
  <a href="https://github.com/finos/git-proxy">
    <img src="./docs/img/logo.png" alt="Logo" height="95">
  </a>

  <br />
  <br />

  <p align="center">
    Deploy custom push protections and policies<br />on top of Git
    <br />
    <br />
    <a href="https://www.npmjs.com/package/@finos/git-proxy"><strong><code>npm install @finos/git-proxy</code></strong></a>
    <br />
    <br />
    <a href="https://git-proxy.finos.org">Docs</a>
    ·
    <a href="https://github.com/finos/git-proxy/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=">Report a bug</a>
    ·
    <a href="https://github.com/finos/git-proxy/issues/new?assignees=&labels=&projects=&template=feature_request.md&title=">Suggest a new feature</a>
  </p>

  <br />

[![FINOS - Incubating](https://cdn.jsdelivr.net/gh/finos/contrib-toolbox@master/images/badge-incubating.svg)](https://finosfoundation.atlassian.net/wiki/display/FINOS/Incubating)
[![NPM](https://img.shields.io/npm/v/@finos/git-proxy?colorA=00C586&colorB=000000)](https://www.npmjs.com/package/@finos/git-proxy)
[![Build](https://img.shields.io/github/actions/workflow/status/finos/git-proxy/nodejs.yml?branch=main&label=CI&logo=github&colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/actions/workflows/nodejs.yml)
[![Documentation](https://img.shields.io/badge/_-documentation-000000?colorA=00C586&logo=docusaurus&logoColor=FFFFFF&)](https://git-proxy.finos.org)
<br />
[![License](https://img.shields.io/github/license/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/blob/main/LICENSEP)
[![Contributors](https://img.shields.io/github/contributors/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/graphs/contributors)
[![Stars](https://img.shields.io/github/stars/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/stargazers)
[![Forks](https://img.shields.io/github/forks/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/forks)

</div>
<br />

## About Git Proxy

<img align="right" width="550" src="./docs/img/demo.png" alt="Git Proxy Demonstration" />


Git Proxy deploys custom push protections and policies on top of Git. It is a highly configurable framework allowing developers and organizations to enforce push protections relevant to their developer workflow, security posture and risk appetite.

Git Proxy is built with a developer-first mindset. By presenting simple-to-follow remediation instructions in the CLI/Terminal, it minimises the friction of use and adoption, and keeps developers focused on what matters; committing and pushing code.


## Installation

To install Git Proxy, you must first install [Node.js](https://nodejs.org/en/download). Then, use the [npm](https://www.npmjs.com/) package manager:

```bash
npm install -g @finos/git-proxy
```

To install a specific version of Git Proxy, append the version to the end of the `install` command:

```bash
npm install -g @finos/git-proxy@1.1.0
```

## Run Git Proxy ⚡

Once you have followed the [installation](#installation) steps, run Git Proxy with:

```bash
git-proxy
```

Alternatively, if you prefer the magic of [npx over npm](https://www.freecodecamp.org/news/npm-vs-npx-whats-the-difference/), you can run Git Proxy with:

```bash
npx --package=@finos/git-proxy@1.1.0 -- git-proxy # No installation required...
```

## Quickstart 🚀

#### 1. Run Git Proxy with simple config

Create a `proxy.config.json` in a workspace with the following:

```json
{
    "authorisedList": [
    {
      "project": "<YOUR-GITHUB-USERNAME>",
      "name": "git-proxy",
      "url": "https://github.com/<YOUR-GITHUB-USERNAME>/git-proxy.git"
    }
  ],
}
```

Then run Git Proxy and load your `proxy.config.json` configuration file from your workspace:

```bash
npx --package=@finos/git-proxy@1.1.0 -- git-proxy --config ./proxy.config.json
```

#### 2. Pick a repository

Git Proxy sits between the local clone of your repository and its remote upstream. Essentially, instead of communicating directly with the **live** version of your repository, you configure your local clone to speak with Git Proxy first.

For demonstration purposes, we recommend 👉 [forking Git Proxy](https://github.com/finos/git-proxy/fork) and cloning the repository to your PC:

```bash
git clone https://github.com/<YOUR-GITHUB-USERNAME>/git-proxy.git
```

Pretty meta, huh? Testing Git Proxy on Git Proxy...

#### 3. Introduce Git Proxy to your clone

Navigate into your test-bed repository on your PC:

```bash
cd ./git-proxy
```

By default the clone of your repository will communicate with GitHub. To change this, so that your local copy of the repository speaks with Git Proxy, run:

```bash
git remote set-url origin http://localhost:8000/<YOUR-GITHUB-USERNAME>/git-proxy.git
```

#### 4. Make some changes to the codebase

Open up the `README.md` and turn this frown upside-down: ☹️

Once you've cheered up our friend above, run:

```bash
git add README.md
git commit -m "fix: turn frown upside-down"
```

####  5. Push your changes via Git Proxy

```bash
git push
```

Git Proxy will prompt the entry of your git credentials. These credentials are your GitHub username and a [Personal Access Token](https://github.com/settings/tokens). For the ability to push and pull code through Git Proxy, you will only require the `public_repo` scope.

Git Proxy will reprompt you for credentials each time you push. To automatically re-use your credentials, you can run:

```bash
git config --global credential.helper osxkeychain # MacOS

git config --global credential.helper manager # Windows

git config --global credential.helper store # Linux
```

#### 6. Success

Immediately after a push, you should receive the following message in your terminal:

```bash
remote: Git Proxy has received your push 🎉
remote: ----------------------------------------------------------
remote:    Commit from | 000000
remote:     Commit to  | b12557
remote:        URL     | http://localhost:8080/push/000000__b12557    
```

## Configuring Git Proxy ⚙️

By default, Git Proxy ships with an out-of-the-box configuration.

To customise your Git Proxy configuration, create a `proxy.config.json` in your directory.

To specify a different file name for your Git Proxy configuration, use:

```bash
git-proxy --config ./config.json
```

Or with npx:

```bash
npx -- @finos/git-proxy --config ./config.json
```

## Know Your Configuration (KYC) ✅

To check that your Git Proxy configuration is valid, run:

```bash
git-proxy --validate
```

To validate your configuration at a custom file location, run:

```bash
git-proxy --validate --config ./config.json
```

## Contributing

Your contributions are at the core of making this a true open source project. Any contributions you make are **greatly appreciated**.

<br />

<a src="https://github.com/finos/git-proxy/fork">
<img align="right" width="300" src="https://firstcontributions.github.io/assets/Readme/fork.png" alt="fork this repository" />
</a>

#### Fork the repository

Click on the **fork** button at the top of the page. This will create a copy of this repository under your GitHub account.

<br />
<br />

#### Clone the repository

<img align="right" width="300" src="https://firstcontributions.github.io/assets/Readme/copy-to-clipboard.png" alt="copy URL to clipboard" />

**Clone** the repository to your machine. Go to the repository via your GitHub account and click on the **Code** button.

Run the following command in your CLI/Terminal:

```bash
git clone https://github.com/YOUR_GITHUB_USRERNAME/git-proxy.git
```

<br />
<br />

#### Branch, code, commit and push

<br />

##### Branch

You can start coding on the default branch on your fork of the project, commonly `master` or `main`. If you want to create a branch to clearly identify your work, run:

```bash
git checkout -b feature/name-of-the-feature-you-are-creating
```

<br />

##### Code

This part is up to you. Be creative and write some magical code! 🧙🪄

<br />

##### Commit

Once you have finished making all of your improvements and changes, run the following:

```bash
git commit -m "YOUR COMMIT MESSAGE"
```

<br />

##### Push

Now that you've created a commit with your changes, it's time to push to GitHub:

```bash
git push
```

<br />

##### Open a pull request

With your changes applied to your fork of the project, it's time to [open a pull request from your repository](https://github.com/finos/git-proxy/compare)...

<br />

## Security

If you identify a security vulnerability in the codebase, please follow the steps in [`SECURITY.md`](https://github.com/finos/git-proxy/security/policy). This includes logic-based vulnerabilities and sensitive information or secrets found in code.

## Code of Conduct

We are committed to making open source an enjoyable and respectful experience for our community. See <a href="https://github.com/finos/git-proxy/blob/main/CODE_OF_CONDUCT.md"><code>CODE_OF_CONDUCT</code></a> for more information.

## License

This project is distributed under the Apache-2.0 license. See <a href="./LICENSE"><code>LICENSE</code></a> for more information.

## Contact

If you have a query or require support with this project, [raise an issue](https://github.com/finos/git-proxy/issues). Otherwise, reach out to [help@finos.org](mailto:help@finos.org).

