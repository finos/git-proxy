import { Request } from 'express';

import { Action } from '../../actions';
import { processUrlPath } from '../../routes/helper';
import * as db from '../../../db';

const exec = async (req: Request) => {
  const id = Date.now();
  const timestamp = id;
  let type = 'default';

  //inspect content-type headers to classify requests as push or pull operations
  // see git http protocol docs for more details: https://github.com/git/git/blob/master/Documentation/gitprotocol-http.adoc
  if (req.headers['content-type'] === 'application/x-git-upload-pack-request') {
    type = 'pull';
  } else if (req.headers['content-type'] === 'application/x-git-receive-pack-request') {
    type = 'push';
  }

  // Proxy URLs take the form https://<git proxy domain>:<port>/<proxied domain>/<repoPath>
  // e.g. https://git-proxy-instance.com:8443/github.com/finos/git-proxy.git
  // We'll receive /github.com/finos/git-proxy.git as the req.url / req.originalUrl
  // Add protocol (assume SSL) to reconstruct full URL - noting path will start with a /
  const pathBreakdown = processUrlPath(req.originalUrl);
  let url = 'https:/' + (pathBreakdown?.repoPath ?? 'NOT-FOUND');

  console.log(`Parse action calculated repo URL: ${url} for inbound URL path: ${req.originalUrl}`);

  if (!(await db.getRepoByUrl(url))) {
    // fallback for legacy proxy URLs
    // legacy git proxy paths took the form: https://<git proxy domain>:<port>/<repoPath>
    // by assuming the host was github.com
    url = 'https://github.com' + (pathBreakdown?.repoPath ?? 'NOT-FOUND');
    console.log(
      `Parse action fallback calculated repo URL: ${url} for inbound URL path: ${req.originalUrl}`,
    );
  }

  return new Action(id.toString(), type, req.method, timestamp, url);
};

exec.displayName = 'parseAction.exec';

export { exec };
