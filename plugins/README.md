# Git Proxy plugins & samples
Git Proxy supports extensibility in the form of plugins. These plugins are specified via [configuration](/docs/category/configuration) as NPM packages or JavaScript code on disk. For each plugin configured, Git Proxy will attempt to load each package or file as a standard [Node module](https://nodejs.org/api/modules.html). Plugin authors will create instances of the extension classes exposed by Git Proxy and use these objects to implement custom functionality.

For detailed documentation, please refer to the [Git Proxy development resources on the project's site](https://git-proxy.finos.org/docs/development/plugins)

## Included plugins
These plugins are maintained by the core Git Proxy team. As a future roadmap item, organizations can choose to omit
certain features of Git Proxy by simply removing the dependency from a deployed version of the application.

- `git-proxy-plugin-samples`: "hello world" examples of the Git Proxy plugin system
