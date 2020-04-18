# corporate-github-proxy

Many corporations, especially financial services have strict policies towards opensource contributions. On rare occasions when a developer can contribute to open source, Information security and compliance officers often demand complex shadow processes are set up to ensure code reviews, scans and other processes are adhered to before a push to the public repo takes place.

We wish to keep the process for the developer as simple and familiar as possible, therefore we feel the solution is a proxy that sits between the developer and the public repository. 

The idea is to scan outgoing attempts to push and raise actions/events which return 

## Roadmap 
- Public repository whitelisting - check the repository
- Synchronous Pluggable webhooks 
- Asynchronous flows - i.e. the proxy will return the correct responses to the git client that the action has taken place, but wait for an external signal to - continue to the push. 
- Become a "true" proxy that can be set via "git config http.proxy...."
- Implement User access controls against corporate AD groups as well as public github accounts.
