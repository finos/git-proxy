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

The plugin runs `git` through `simple-git`. For HTTPS upstreams with self-signed certificates, configure git with the right CA (or set `GIT_SSL_NO_VERIFY`).

## Contributing

Please refer to the [CONTRIBUTING.md](https://git-proxy.finos.org/docs/development/contributing) file for information on how to contribute to the GitProxy project.
