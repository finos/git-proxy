# (Corporate) Git Proxy

[![FINOS - Forming](https://cdn.jsdelivr.net/gh/finos/contrib-toolbox@master/images/badge-forming.svg)](https://finosfoundation.atlassian.net/wiki/display/FINOS/Incubating)

Many corporations, especially financial services have strict policies towards opensource contributions. On rare occasions when a developer can contribute to open source, information security and compliance officers often demand complex shadow processes are set up to ensure code reviews, scans and other processes are adhered to before a push to the public repo takes place.

We wish to keep the process for the developer as simple and familiar as possible, therefore we feel the solution is a proxy that sits between the developer and the public repository.

The idea is quite simple, scan outgoing attempts to push to public repositor and raise compliance/info-sec friendly checks before allowing the push to complete.

Of course every corporation will have different procedures so a key feature has to be the extensibility of the framework.

## Project Installation Instructions

All contributions are welcome. Please fork the repository before local development.

1. Clone `git-proxy` using `git clone <repo path>/git-proxy`
2. Navigate to project directory with `cd git-proxy`

Install and run

- Install project dependencies using `npm i` or `npm install`
- Start Express server using `npm start` after the project has installed.

``` bash
 git-proxy@0.0.1 start C:\projects\github-proxy
 concurrently "npm run server" "npm run client

   git-proxy@0.0.1 server C:\projects\github-proxy
   node index.js

   git-proxy@0.0.1 client C:\projects\github-proxy
   react-scripts start & node index.js

   authorisedList = ["pGrovesy/test-allowed-repo.git","pGrovesy/git-proxy.git"]
   data sink = "fs"
   fs
   Successfully connected to : ./.data/db
   {
      getPushes: [Function: getPushes],
      writeAudit: [Function: writeAudit],
      getPush: [Function: getPush],
      authorise: [Function: authorise],
      findByUsername: [Function (anonymous)],
      findById: [Function (anonymous)]
   }
   Listening on 8000
   Service Listening on 8080
   i ｢wds｣: Project is running at http://192.168.0.82/
   i ｢wds｣: webpack output is served from
   i ｢wds｣: Content not from webpack is served from C:\projects\github-proxy\public
   i ｢wds｣: 404s will fallback to /
   Starting the development server...
```

### Testing a Repo Through the Proxy

Now the project is running, lets test a repo through the proxy. Clone a repo that is in the authorised list (see /resources/config.json)

``` bash
c:\projects\
git clone http://localhost:8000/finos/test-allowed-repo
```

1. Edit the README.md file in 'test-allowed-repo' repo
2. run 'push.bat'
3. You should see some activity in the node.js proxy windows
4. Everything should have pushed to the remote repo.

#### Testing a non-authorised-repo

Clone a repo that is *not* in the authorised list (see /resources/config.json), for example:

```bash

c:\projects\
git clone http://localhost:8000/finos/test-banned-repo
```

1. Edit the README.md file in 'test-allowed-repo' repo
2. run 'push.bat'
3. You should see some activity in the node.js proxy windows
4. The git push should result in an error

``` cmd
C:\projects\github-proxy>git push origin ui2-and-authorisation
Enumerating objects: 11, done.
Counting objects: 100% (11/11), done.
Delta compression using up to 8 threads
Compressing objects: 100% (6/6), done.
Writing objects: 100% (6/6), 613 bytes | 613.00 KiB/s, done.
Total 6 (delta 3), reused 0 (delta 0), pack-reused 0
remote: ERR     pGrovesy/test-banned-repo is not listed as an authorised repository
fatal: the remote end hung up unexpectedly
fatal: the remote end hung up unexpectedly
error: failed to push some refs to 'http://localhost:8000/pGrovesy/git-proxy.git'

```

The push essentially rejected

## Local Project Configuration

The file `user-settings.json` exists in the project root to override `config.json` for local developer configuration. The following describes how to use `user-settings.json`

- If the file exists in the project root `user-settings.json` overrides `config.json`
- If `user-settings.json` does not exist `config.json` is used.
- The `json` format of `user-settings.json` mirrors `config.json`. This enables local development scenarios, such as forking test repos as illustrated below.
  - Fork `finos/test-allowed-repo` and `finos/test-banned-repo`
  - Add the forked `test-allowed-repo` to `user-settings.json` in your project root as below ...

    ``` bash
    {
      "repoAuthorisedList": [
        "<git project>/test-allowed-repo.git"
      ]
    }
    ```

- Run `git clone http://localhost:8000/<git project>/test-allowed-repo`
- Run `git clone http://localhost:8000/<git project>/test-banned-repo`
- Edit the README.md file in `test-allowed-repo` and `test-banned-repo` repo.
- Run the `git` instructions highlighted in `push.bat` as illustrated in **Testing a Repo Through the Proxy**.

The project is now set up for local development, including `git push origin master` to your forked repos.

## Roadmap

- Public repository whitelisting
- Synchronous Pluggable webhooks
- Asynchronous flows - i.e. the proxy will return the correct responses to the git client that the action has taken place, but wait for an external signal to - continue to the push.
- Become a "true" proxy that can be set via `git config http.proxy....`
- Implement User access controls against corporate AD groups as well as public github accounts.
- Auditing sink + UI

Please [raise an issue](https://github.com/finos/git-proxy/issues/new/choose) if you have an idea!

## Contributing

1. Fork it [link](<https://github.com/finos/project slug}/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Read our [contribution guidelines](.github/CONTRIBUTING.md) and [Community Code of Conduct](https://www.finos.org/code-of-conduct)
4. Commit your changes (`git commit -am 'Add some fooBar'`)
5. Push to the branch (`git push origin feature/fooBar`)
6. Create a new Pull Request

_NOTE:_ Commits and pull requests to FINOS repositories will only be accepted from those contributors with an active, executed Individual Contributor License Agreement (ICLA) with FINOS OR who are covered under an existing and active Corporate Contribution License Agreement (CCLA) executed with FINOS. Commits from individuals not covered under an ICLA or CCLA will be flagged and blocked by the FINOS Clabot tool. Please note that some CCLAs require individuals/employees to be explicitly named on the CCLA.

*Need an ICLA? Unsure if you are covered under an existing CCLA? Email [help@finos.org](mailto:help@finos.org)*

## License

Copyright 2020 Citigroup

Distributed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

SPDX-License-Identifier: [Apache-2.0](https://spdx.org/licenses/Apache-2.0)

