import { Action } from '../../actions';

const exec = async (req: {
  originalUrl: string;
  method: string;
  headers: Record<string, string>;
}) => {
  const id = Date.now();
  const timestamp = id;
  const repoName = getRepoNameFromUrl(req.originalUrl);
  const paths = req.originalUrl.split('/');

  let type = 'default';

  if (paths[paths.length - 1].endsWith('git-upload-pack') && req.method === 'GET') {
    type = 'pull';
  }
  if (
    paths[paths.length - 1] === 'git-receive-pack' &&
    req.method === 'POST' &&
    req.headers['content-type'] === 'application/x-git-receive-pack-request'
  ) {
    type = 'push';
  }

  return new Action(id.toString(), type, req.method, timestamp, repoName);
};

const getRepoNameFromUrl = (url: string): string => {
  const parts = url.split('/');
  for (let i = 0, len = parts.length; i < len; i++) {
    const part = parts[i];
    if (part.endsWith('.git')) {
      return `${parts[i - 1]}/${part}`.trim();
    }
  }
  return 'NOT-FOUND';
};

exec.displayName = 'parseAction.exec';

export { exec };
