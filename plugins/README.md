# Plugins
Git Proxy has a simple mechanism for exposing customization within the application for organizations who wish to augment Git Proxy's built-in features, add custom functionality or integrate Git Proxy & other systems within their environment. Plugins are authored via custom objects & functions in JavaScript and can be distributed as NPM packages or source files. Plugins are loaded at deployment via configuration of the git-proxy application server.

## Loading plugins
In order to load a plugin, you must either install the plugin as a standalone npm package by adding the plugin as a dependency or specify a file path on disk to load a `.js` file as a module.

### NPM
1. Add the plugin package as a dependency.
```json
{
  "name": "@finos/git-proxy",
  ...
  "dependencies: {
    "foo-my-gitproxy-plugin": "^0.0.1",
    "@bar/another-gitproxy-plugin": "^0.0.1",
  }
}
```

2. Set the "pushPlugins" property in proxy.config.json to a list of modules to load into Git Proxy. These packages must exist in `node_modules/`.

```json
{
  "pushPlugins": [
    "foo-my-gitproxyplugin",
    "@bar/another-gitproxy-plugin"
  ]
}
```

### Local files
1. Download the plugin's source files & run `npm install` to download any dependencies of the plugin itself.
2. Set the "pushPlugins" property in proxy.config.json to a list of files to load into Git Proxy.
```json
{
  "pushPlugins": [
    "./plugins/foo/index.js",
    "/home/alice/gitproxy-push-plugin/index.js"
  ]
}
```

### Environment variables (deprecated)
The previous implementation of plugins were loaded via the following two environment variables:

- `GITPROXY_PLUGIN_FILES`: a list of comma-separated JavaScript files which point to Node modules that contain plugin objects
- `GITPROXY_PLUGIN_PACKAGES`: a list of comma-separated NPM packages which contain modules & plugin objects

Any files or packages specified by these variables will continue to be loaded via the plugin loader if set. However, it is recommended to simply list either files or NPM packages to load as plugins via configuration as documented above. These environment variables will be removed in a future release.

```bash
# Setting a list of plugin packages to load via env var when running git-proxy
$ export GITPROXY_PLUGIN_PACKAGES="foo-my-gitproxyplugin,@bar/another-gitproxy-plugin/src/plugins/baz"
$ npx -- @finos/git-proxy
```

## Writing plugins
Plugins are written as Node modules which export objects containing the custom behaviour. These objects must extend the classes exported by Git Proxy's `plugin/` module. The only class which is exported today for developers to extend Git Proxy is called the `PushActionPlugin` class. This class executes the custom behaviour on any `git push` going through Git Proxy.

The `PushActionPlugin` class takes a single function into its constructor which is executed on a `git push`. This is then loaded into the push proxy's "chain" of actions. Custom plugins are executed after parsing of a push but before any builtin actions. It is important to be aware of the load order when writing plugins to ensure that one plugin does not conflict with another. The order specified in `pushPlugins` configuration setting is preserved by the loader.

To write a custom plugin, import the `PushActionPlugin` class from `@finos/git-proxy` and create a new type with your custom function:

```javascript
// plugin-foo/index.js
const PushActionPlugin = require('@finos/git-proxy/src/plugin').PushActionPlugin;

class MyPlugin extends PushActionPlugin {
  constructor() {
    super((req, action) => {
      console.log(req); // Log the express.Request object
      // insert custom behaviour here using the Action object...
      return action;
    })
  }
}

module.exports = new MyPlugin();
```

> Note: use `peerDependencies` to depend on `@finos/git-proxy` in your plugin's package to avoid circular dependencies!

## Sample plugin
Git Proxy includes a sample plugin that can be loaded with any deployment for demonstration purposes. This plugin is not published as a standalone NPM package and must be used as a local file during deployment. To use the sample plugin:

1. Run `npm install` in [./plugins/git-proxy-hello-world](./git-proxy-hello-world/).
2. Set "pushPlugins" in `proxy.config.json`:
```json
{
  "pushPlugins": [
    "./plugins/git-proxy-hello-world/index.js"
  ]
}
```
3. Run Git Proxy from source:
```
npm run start
```
