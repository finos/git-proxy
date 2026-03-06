import { Action, Step } from '../../actions';
import fs from 'fs';
import path from 'path';
import { PerformanceTimer } from './metrics';
import { cacheManager } from './cache-manager';
import * as gitOps from './git-operations';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('pullRemote');
  const timer = new PerformanceTimer(step);

  // Get cache directories from configuration
  const config = cacheManager.getConfig();
  const BARE_CACHE = config.repoCacheDir;
  const WORK_DIR = path.join(path.dirname(BARE_CACHE), 'work');

  // Paths for hybrid architecture
  const bareRepo = path.join(BARE_CACHE, action.repoName);
  const workCopy = path.join(WORK_DIR, action.id);

  // Set proxyGitPath early so post-processor can clean up on failure
  action.proxyGitPath = workCopy;

  // Concurrent request protection: the working copy should not exist yet
  if (fs.existsSync(workCopy)) {
    const errMsg =
      'The working copy folder already exists - we may be processing a concurrent request for this push. If this issue persists the proxy may need to be restarted.';
    step.setError(errMsg);
    action.addStep(step);
    throw new Error(errMsg);
  }

  try {
    const bareExists = fs.existsSync(bareRepo);

    step.log(`Bare cache: ${bareExists ? 'EXISTS' : 'MISSING'}`);
    step.log(`Strategy: ${bareExists ? 'FETCH + LOCAL_CLONE' : 'BARE_CLONE + LOCAL_CLONE'}`);

    const strategy = bareExists ? 'CACHED' : 'CLONE';
    timer.start(`${strategy} ${action.repoName}`);

    if (!fs.existsSync(BARE_CACHE)) {
      fs.mkdirSync(BARE_CACHE, { recursive: true });
    }
    if (!fs.existsSync(WORK_DIR)) {
      fs.mkdirSync(WORK_DIR, { recursive: true });
    }
    timer.mark('Setup complete');

    const authHeader = req.headers?.authorization;
    const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64')
      .toString()
      .split(':');

    // PHASE 1: Bare Cache (persistent, shared)
    if (bareExists) {
      step.log(`Fetching updates in bare cache...`);
      try {
        await gitOps.fetch({
          dir: bareRepo,
          url: action.url,
          username,
          password,
          depth: 1,
          prune: true,
          bare: true,
        });
        await cacheManager.touchRepository(action.repoName);
        timer.mark('Fetch complete');
        step.log(`Bare repository updated`);
      } catch (fetchError) {
        step.log(`Fetch failed, rebuilding bare cache: ${fetchError}`);
        if (fs.existsSync(bareRepo)) {
          fs.rmSync(bareRepo, { recursive: true, force: true });
        }
        await gitOps.clone({
          dir: bareRepo,
          url: action.url,
          username,
          password,
          bare: true,
          depth: 1,
        });
        timer.mark('Bare clone complete (fallback)');
      }
    } else {
      step.log(`Cloning bare repository to cache...`);
      await gitOps.clone({
        dir: bareRepo,
        url: action.url,
        username,
        password,
        bare: true,
        depth: 1,
      });
      timer.mark('Bare clone complete');
      step.log(`Bare repository created at ${bareRepo}`);
      await cacheManager.touchRepository(action.repoName);
    }

    // PHASE 2: Working Copy (temporary, isolated per push)
    step.log(`Creating isolated working copy for push ${action.id}...`);
    const workCopyPath = path.join(workCopy, action.repoName);

    await gitOps.cloneLocal({
      sourceDir: bareRepo,
      targetDir: workCopyPath,
      depth: 1,
    });

    timer.mark('Working copy ready');
    step.log(`Working copy created at ${workCopyPath}`);

    const completedMsg = bareExists
      ? `Completed fetch + local clone (hybrid cache)`
      : `Completed bare clone + local clone (hybrid cache)`;

    step.log(completedMsg);
    step.setContent(completedMsg);

    timer.end();

    // Enforce cache limits (LRU eviction on bare cache)
    const evictionResult = await cacheManager.enforceLimits();
    if (evictionResult.removedRepos.length > 0) {
      const freedMB = (evictionResult.freedBytes / (1024 * 1024)).toFixed(2);
      step.log(`LRU evicted ${evictionResult.removedRepos.length} bare repos, freed ${freedMB}MB`);
    }
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    // Clean up working copy on failure so it doesn't block subsequent attempts
    if (fs.existsSync(workCopy)) {
      fs.rmSync(workCopy, { recursive: true, force: true });
      step.log(`Working copy cleaned up after failure`);
    }
    throw e;
  } finally {
    action.addStep(step);
  }

  return action;
};

exec.displayName = 'pullRemote.exec';

export { exec };
