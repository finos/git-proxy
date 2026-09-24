# GitProxy plugins & samples

GitProxy supports extensibility in the form of plugins. These plugins are specified via [configuration](https://git-proxy.finos.org/docs/category/configuration) as NPM packages or JavaScript code on disk. For each plugin configured, GitProxy will attempt to load each package or file as a standard [Node module](https://nodejs.org/api/modules.html). Plugin authors will create instances of the extension classes exposed by GitProxy and use these objects to implement custom functionality.

For detailed documentation, please refer to the [GitProxy development resources on the project's site](https://git-proxy.finos.org/docs/development/plugins)

## Included plugins

These plugins are maintained by the core GitProxy team. As a future roadmap item, organizations can choose to omit
certain features of GitProxy by simply removing the dependency from a deployed version of the application.

- `git-proxy-plugin-samples`: "hello world" examples of the GitProxy plugin system
- `check-dependency-vulnerabilities`: blocks pushes that introduce dependencies with known CVEs

### check-dependency-vulnerabilities

Scans dependency files changed in a push (e.g. `package.json`, `pom.xml`, `requirements.txt`) against
the [OWASP National Vulnerability Database](https://jeremylong.github.io/DependencyCheck/analyzers/index.html)
using the [dependency-check](https://owasp.org/www-project-dependency-check/) CLI tool.

**Prerequisites**

- The `dependency-check` CLI must be installed and available in `PATH`.
- Run `dependency-check --updateonly` at least once after installation to populate the NVD database.
  Repeat periodically to keep vulnerability data current (the plugin uses `--noupdate` on each scan
  to avoid the 20-30 minute refresh overhead).

**Configuration**

Set the `DEPENDENCY_VULN_THRESHOLD` environment variable to control which severity levels trigger a block.
Pushes containing vulnerabilities at or above the threshold will be held for human review.

| Value      | Blocks                      |
| ---------- | --------------------------- |
| `CRITICAL` | Critical only               |
| `HIGH`     | High and Critical (default) |
| `MEDIUM`   | Medium, High, and Critical  |
| `LOW`      | Low and above               |
| `INFO`     | All findings                |

**Enabling the plugin**

Add the plugin path to the `plugins` array in your `proxy.config.json`:

```json
{
  "plugins": ["./plugins/git-proxy-plugin-samples/checkDependencyVuln.js"]
}
```

## Contributing

Please refer to the [CONTRIBUTING.md](https://git-proxy.finos.org/docs/development/contributing) file for information on how to contribute to the GitProxy project.
