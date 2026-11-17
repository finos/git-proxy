# @finos/git-proxy-cli

Command line interface for [GitProxy](https://github.com/finos/git-proxy). Use it to log in to a running GitProxy server and list, approve, reject or cancel pushes without opening the web UI.

## Install

```bash
npm install -g @finos/git-proxy-cli
```

The CLI is released alongside [`@finos/git-proxy`](https://www.npmjs.com/package/@finos/git-proxy) and shares its version number. Install the CLI version matching your GitProxy server, for example `npm install -g @finos/git-proxy-cli@2.3.1`.

## Usage

```bash
git-proxy-cli login --username admin --password admin
git-proxy-cli ls --authorised false --canceled false --rejected false
git-proxy-cli authorise --id <push-id>
git-proxy-cli logout
```

Run `git-proxy-cli --help` for the full list of commands. By default, the CLI talks to `http://localhost:8080`. Set `GIT_PROXY_UI_HOST` and `GIT_PROXY_UI_PORT` to interact with a different server.

See the [GitProxy documentation](https://git-proxy.finos.org/docs/quickstart/approve) for a full walkthrough.

## License

Apache-2.0
