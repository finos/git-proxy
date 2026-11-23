# GitProxy plugins & samples

GitProxy supports extensibility in the form of plugins. These plugins are specified via [configuration](https://git-proxy.finos.org/docs/category/configuration) as NPM packages or JavaScript code on disk. For each plugin configured, GitProxy will attempt to load each package or file as a standard [Node module](https://nodejs.org/api/modules.html). Plugin authors will create instances of the extension classes exposed by GitProxy and use these objects to implement custom functionality.

For detailed documentation, please refer to the [GitProxy development resources on the project's site](https://git-proxy.finos.org/docs/development/plugins)

## Included plugins

These plugins are maintained by the core GitProxy team. As a future roadmap item, organizations can choose to omit
certain features of GitProxy by simply removing the dependency from a deployed version of the application.

- `git-proxy-plugin-samples`: "hello world" examples of the GitProxy plugin system

## Samples

Each sample is enabled by adding its specifier to the `plugins` array in `proxy.config.json`:

- `@finos/git-proxy-plugin-samples` (`index.js`): ESM pull plugin that logs each fetch request.
- `@finos/git-proxy-plugin-samples/example.cjs` (`example.cjs`): CommonJS push plugins that log each push request.
- `@finos/git-proxy-plugin-samples/customSecretScanner` (`customSecretScanner.ts`): TypeScript push plugin that scans the diff of branch pushes for secrets.

Pull samples are split into data plugins, which only collect/extract information about a pull, and policy plugins, which decide whether to allow or block:

- Data plugin: `@finos/git-proxy-plugin-samples/extractPullData` (`extractPullData/`). Parses `git fetch` requests, fetches the wanted commits into a temporary bare repo and resolves them to commit hashes.
- Policy plugin: `@finos/git-proxy-plugin-samples/pullSecretScanner` (`pullSecretScanner.ts`). Scans the commits being fetched for secrets. `extractPullData` must also be set for this to work.

The TypeScript samples are compiled to `dist/` by `npm run build`.

### Scanning pulls

GitProxy doesn't parse or fetch pulls by default, it merely checks that an admin has enabled to pull from that repo. Pull plugins only see basic `Action` fields (`action.url`, `action.repo`, etc.). In order to inspect actual content being fetched, you need two types of plugins (both of these available in `@finos/git-proxy-plugin-samples`):

- A **data plugin** that parses the raw git request and stores information about the pull into the `Action`. It doesn't enforce any policies by itself, but may reject the pull if it fails to extract the data. [`extractPullData`](https://github.com/finos/git-proxy/tree/main/plugins/git-proxy-plugin-samples/extractPullData) is the sample data plugin.
- A **policy plugin** that reads the data and decides whether the pull is allowed. [`pullSecretScanner`](https://github.com/finos/git-proxy/tree/main/plugins/git-proxy-plugin-samples/pullSecretScanner.ts) is a sample policy plugin.

These two sample plugins can be used as follows:

```json
{
  "plugins": [
    "@finos/git-proxy-plugin-samples/extractPullData",
    "@finos/git-proxy-plugin-samples/pullSecretScanner"
  ]
}
```

If you look at the plugin code, you'll notice that they don't import each other. They work by sharing the `Action` fields described below. Their order in `plugins` doesn't matter either, since they run in their defined `Phase`.

#### Data provided by `extractPullData`

- `action.pullData`: The parsed upload-pack request object which includes: `command`, `wants`, `haves`, `wantRefs`, `refPrefixes`, `shallow`, `capabilities`, etc. `action.actionType` is set to `fetch` or `ls-refs`.
- `action.proxyGitPath`: A _temporary_ bare repository containing a shallow, blobless fetch of the wanted commits (`pullData.fetchedWants`). It gets deleted once the chain has finished.
- `pullData.base` / `action.commitFrom` and `action.commitTo`: The pull's diff range. The base is the first of the client's `haves` that exists upstream (all zeros if none, meaning a full-tree scan). `commitTo` is the first want.
- `pullData.wantedRefs`, `action.branch` and `action.tags`: The ref names the wanted commits resolve to.

The plugin runs `git` through `simple-git`. For HTTPS upstreams with self-signed certificates, configure git with the right CA.

## How to integrate external services

Our `ExternalServiceIntegration` plugin (`@finos/git-proxy-plugin-samples/externalServiceIntegration`) shows how to integrate a GitProxy plugin with an external service, and keep the `git push` connection open while waiting for the service to complete. It also demonstrates how to handle client disconnection.

In this example, we're using a mock Data Loss Prevention (DLP) service.

### Components

- `externalServiceIntegration.ts` is the actual `PushActionPlugin`. It sends the diff to the mock DLP service, waits for the verdict, and finally lets the push continue (or blocks it).
  - `submitScan` calls the mock service. Replace this with a call to your actual external service
  - `waitForResult` waits for the result to come back, and also checks for client disconnection via `isClientDisconnected`. Replace the `DlpScan` parameter with the relevant object handle (i.e. a `Job` or `Scan` object) for the actual service

- `mockDlpService.ts` is a fake DLP service. It doesn't depend on GitProxy: it takes each scan and answers it with a random verdict after a random delay. Replace this with a client for your real service.
  - The verdict is randomized and the delay is too: some scans take a few seconds (2-30 seconds) while others take much longer (1-10 minutes).
  - Since the default timeout is 5 minutes, some scans will time out. `ExternalServiceIntegration` handles this in `result.status === 'timeout'`. The push is rejected but the scan continues in the external service. The user is prompted to push again in order to reattach the scan
  - If the DLP approves the scan, the push continues through the remaining chain steps. If rejected, the push is blocked with a random reason from `REJECTION_REASONS`
  - If the client disconnects while waiting, the scan continues and it will be reattached in the next `git push`

Note that `ExternalServiceIntegration` runs in the `AFTER_DIFF` phase of the branch push chain.

### Try it out

1. Run `npm run build` in this directory and install the package next to GitProxy (see the [plugin documentation](https://git-proxy.finos.org/docs/development/plugins)).
2. Add the plugin to `proxy.config.json`:

```json
{
  "plugins": ["@finos/git-proxy-plugin-samples/externalServiceIntegration"]
}
```

3. Optionally, create an executable `hooks/pre-receive.sh` file relative to the directory where GitProxy is started. Make the hook exit with `0` so that pushes skip the manual approval phase. Combined with the `ExternalServiceIntegration` sample, pushes approved by the DLP are automatically approved, rejected ones are automatically rejected.

```bash
mkdir -p hooks
printf '#!/bin/sh\nexit 0\n' > hooks/pre-receive.sh
chmod +x hooks/pre-receive.sh
```

4. Start GitProxy and make a push. See the `[MockDLP]` and `[ExternalServiceIntegration]` output in the server logs. Mock scans log their result and delay ahead of time so GitProxy behaviour is easier to understand.

## Contributing

Please refer to the [CONTRIBUTING.md](https://git-proxy.finos.org/docs/development/contributing) file for information on how to contribute to the GitProxy project.
