import { Action, RequestType } from '../../actions';
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
  let type: RequestType | string = 'default';
  if (pathBreakdown) {
    if (pathBreakdown.gitPath.endsWith('git-upload-pack') && req.method === 'GET') {
      type = RequestType.PULL;
    }
    if (
      pathBreakdown.gitPath.includes('git-receive-pack') &&
      req.method === 'POST' &&
      req.headers['content-type'] === 'application/x-git-receive-pack-request'
    ) {
      type = RequestType.PUSH;
    }
  } // else failed to parse proxy URL path - which is logged in the parsing util

  // Proxy URLs take the form https://<git proxy domain>:<port>/<proxied domain>/<repoPath>
  // e.g. https://git-proxy-instance.com:8443/github.com/finos/git-proxy.git
  // We'll receive /github.com/finos/git-proxy.git as the req.url / req.originalUrl
  // Add protocol (assume SSL) to reconstruct full URL - noting path will start with a /
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

  return new Action(id.toString(), type as RequestType, req.method, timestamp, url);
};

exec.displayName = 'parseAction.exec';

export { exec };
