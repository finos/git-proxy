import { Action, Step } from '../../actions';
import fs from 'fs';
import path from 'path';
import { PerformanceTimer } from './metrics';
import { cacheManager } from './cache-manager';
import * as gitOps from './git-operations';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('pullRemote');
  const timer = new PerformanceTimer(step);

  try {
    // Get cache directories from configuration
    const config = cacheManager.getConfig();
    const BARE_CACHE = config.cacheDir;
    const WORK_DIR = path.join(path.dirname(BARE_CACHE), 'work');

    // Paths for hybrid architecture
    const bareRepo = path.join(BARE_CACHE, action.repoName);
    const workCopy = path.join(WORK_DIR, action.id);

    // Check if bare cache exists
    const bareExists = fs.existsSync(bareRepo);

    step.log(`Bare cache: ${bareExists ? 'EXISTS' : 'MISSING'}`);
    step.log(`Strategy: ${bareExists ? 'FETCH + LOCAL_CLONE' : 'BARE_CLONE + LOCAL_CLONE'}`);

    // Start timing
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
      // CACHE HIT: Fetch updates in bare repository
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

        // Update access time for LRU
        await cacheManager.touchRepository(action.repoName);
        timer.mark('Fetch complete');
        step.log(`Bare repository updated`);
      } catch (fetchError) {
        step.log(`Fetch failed, rebuilding bare cache: ${fetchError}`);
        // Remove broken cache and re-clone
        if (fs.existsSync(bareRepo)) {
          fs.rmSync(bareRepo, { recursive: true, force: true });
        }

        // Re-clone as fallback
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
      // CACHE MISS: Clone bare repository
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

      // Update access time for LRU after successful clone
      await cacheManager.touchRepository(action.repoName);
    }

    // PHASE 2: Working Copy (temporary, isolated)
    step.log(`Creating isolated working copy for push ${action.id}...`);

    const workCopyPath = path.join(workCopy, action.repoName);

    // Clone from local bare cache (fast local operation)
    await gitOps.cloneLocal({
      sourceDir: bareRepo,
      targetDir: workCopyPath,
      depth: 1,
    });

    timer.mark('Working copy ready');
    step.log(`Working copy created at ${workCopyPath}`);

    // Set action path to working copy
    action.proxyGitPath = workCopy;

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
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'pullRemote.exec';

export { exec };
