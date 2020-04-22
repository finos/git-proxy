# corporate-github-proxy

Many corporations, especially financial services have strict policies towards opensource contributions. On rare occasions when a developer can contribute to open source, information security and compliance officers often demand complex shadow processes are set up to ensure code reviews, scans and other processes are adhered to before a push to the public repo takes place.

We wish to keep the process for the developer as simple and familiar as possible, therefore we feel the solution is a proxy that sits between the developer and the public repository. 

The idea is quite simple, scan outgoing attempts to push to public repositor and raise compliance/info-sec friendly checks before allowing the push to complete. 

Of course every corporation will have different procedures so a key feature has to be the extensibility of the framework.

## Roadmap 

We are looking at the following functionality.

- Public repository whitelisting 
- Synchronous Pluggable webhooks 
- Asynchronous flows - i.e. the proxy will return the correct responses to the git client that the action has taken place, but wait for an external signal to - continue to the push. 
- Become a "true" proxy that can be set via "git config http.proxy...."
- Implement User access controls against corporate AD groups as well as public github accounts.
- Auditing sink + UI
 
Please raise an issue if you have more.

## Project Installation Instructions
All contributions are welcome. Please fork the repository before local development. 
1. Clone `github-proxy` using `git clone <repo path>/github-proxy`   
2. Navigate to project directory with `cd github-proxy`
3. Install project dependencies using `npm i` or `npm install`
4. Start Express server using `npm start` after the project has installed.

Express will now start and listen on the following ports ...

``` bash
  Listening on 3000
  Listening on 3001
```

Now the project is running, lets test a repo through the proxy. Clone a repo that is in the whitelist (see /resources/config.json)

```
c:\projects\
git clone http://localhost:3000/pGrovesy/test-allowed-repo
```
1. Edit the README.md file in 'test-allowed-repo' repo 
2. run 'push.bat'
3. You should see some activity in the node.js proxy windows
4. Everything should have pushed to the remote repo. 

__Testing a non-white-list-repo__

Clone a repo that is *not* in the whitelist (see /resources/config.json), for example:
```
c:\projects\
git clone http://localhost:3000/pGrovesy/test-banned-repo
```

1. Edit the README.md file in 'test-allowed-repo' repo 
2. run 'push.bat'
3. You should see some activity in the node.js proxy windows
4. The git push should result in an error

``` cmd
C:\projects\test-banned-repo>git push origin
Enumerating objects: 17, done.
Counting objects: 100% (17/17), done.
Delta compression using up to 8 threads
Compressing objects: 100% (13/13), done.
Writing objects: 100% (15/15), 1.45 KiB | 1.46 MiB/s, done.
Total 15 (delta 4), reused 0 (delta 0), pack-reused 0
error: RPC failed; HTTP 404 curl 22 The requested URL returned error: 404
fatal: the remote end hung up unexpectedly
fatal: the remote end hung up unexpectedly
Everything up-to-date
``
The push essentially failed - we'll be working on correct response codes in due course

---
