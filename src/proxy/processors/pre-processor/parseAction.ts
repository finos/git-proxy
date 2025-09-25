import { Action } from '../../actions';
import { processUrlPath } from '../../routes/helper';
import * as db from '../../../db';

const exec = async (req: {
  originalUrl: string;
  method: string;
  headers: Record<string, string>;
  protocol?: 'https' | 'ssh';
  sshUser?: {
    username: string;
    email?: string;
    gitAccount?: string;
    sshKeyInfo?: {
      keyType: string;
      keyData: Buffer;
    };
  };
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

  const action = new Action(id.toString(), type, req.method, timestamp, url);

  // Set SSH-specific properties if this is an SSH request
  if (req.protocol === 'ssh' && req.sshUser) {
    action.protocol = 'ssh';
    action.sshUser = req.sshUser;
  } else {
    action.protocol = 'https';
  }

  return action;
};

exec.displayName = 'parseAction.exec';

export { exec };
