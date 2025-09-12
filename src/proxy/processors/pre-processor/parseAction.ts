import { Action } from '../../actions';
import { processUrlPath } from '../../routes/helper';
import * as db from '../../../db';

const exec = async (req: {
  originalUrl: string;
  method: string;
  headers: Record<string, string>;
}) => {
  const id = Date.now();
  const timestamp = id;
  const pathBreakdown = processUrlPath(req.originalUrl);
  let type = 'default';
  if (pathBreakdown) {
    if (pathBreakdown.gitPath.endsWith('git-upload-pack') && req.method === 'GET') {
      type = 'pull';
    } else if (
      pathBreakdown.gitPath.includes('git-receive-pack') &&
      req.method === 'POST' &&
      req.headers['content-type'] === 'application/x-git-receive-pack-request'
    ) {
      type = 'push';
    }
  } // else failed to parse proxy URL path - which is logged in the parsing util

  // Proxy URLs take the form https://<git proxy domain>:<port>/<proxied domain>/<repoPath>
  // e.g. https://git-proxy-instance.com:8443/github.com/finos/git-proxy.git
  // We'll receive /github.com/finos/git-proxy.git as the req.url / req.originalUrl

  let url: string;

  // First, try to find a matching repository by checking both http:// and https:// protocols
  const repoPath = pathBreakdown?.repoPath ?? 'NOT-FOUND';
  const httpsUrl = 'https:/' + repoPath;
  const httpUrl = 'http:/' + repoPath;

  console.log(
    `Parse action trying HTTPS repo URL: ${httpsUrl} for inbound URL path: ${req.originalUrl}`,
  );

  if (await db.getRepoByUrl(httpsUrl)) {
    url = httpsUrl;
  } else {
    console.log(
      `Parse action trying HTTP repo URL: ${httpUrl} for inbound URL path: ${req.originalUrl}`,
    );
    if (await db.getRepoByUrl(httpUrl)) {
      url = httpUrl;
    } else {
      // fallback for legacy proxy URLs - try github.com with https
      url = 'https://github.com' + repoPath;
      console.log(
        `Parse action fallback calculated repo URL: ${url} for inbound URL path: ${req.originalUrl}`,
      );
    }
  }

  return new Action(id.toString(), type, req.method, timestamp, url);
};

exec.displayName = 'parseAction.exec';

export { exec };
