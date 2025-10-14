import { Action, Step } from '../../actions';
import fs from 'fs';
import { PerformanceTimer } from './metrics';
import { cacheManager } from './cache-manager';
import { cloneWorkingCopy, fetchBareRepository, cloneBareRepository } from './git-operations';

const BARE_CACHE = './.remote/cache';
const WORK_DIR = './.remote/work';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('pullRemote');
  const timer = new PerformanceTimer(step);

  try {
    // Paths for hybrid architecture
    // Ensure repoName ends with .git for bare repository convention
    const repoNameWithGit = action.repoName.endsWith('.git')
      ? action.repoName
      : `${action.repoName}.git`;
    const bareRepo = `${BARE_CACHE}/${repoNameWithGit}`;
    const workCopy = `${WORK_DIR}/${action.id}`;

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

    // PHASE 1: Bare Cache (persistent, shared) ===
    if (bareExists) {
      // CACHE HIT: Fetch updates in bare repository
      step.log(`Fetching updates in bare cache...`);

      try {
        await fetchBareRepository(bareRepo, action.url, username, password, step);

        // Update access time for LRU
        cacheManager.touchRepository(`${action.repoName}.git`);
        timer.mark('Fetch complete');
      } catch (fetchError) {
        step.log(`Fetch failed, rebuilding bare cache: ${fetchError}`);
        // Remove broken cache and re-clone
        if (fs.existsSync(bareRepo)) {
          fs.rmSync(bareRepo, { recursive: true, force: true });
        }
        await cloneBareRepository(bareRepo, action.url, username, password, step);
        timer.mark('Bare clone complete (fallback)');
      }
    } else {
      // CACHE MISS: Clone bare repository
      step.log(`Cloning bare repository to cache...`);
      await cloneBareRepository(bareRepo, action.url, username, password, step);
      timer.mark('Bare clone complete');
    }

    // PHASE 2: Working Copy (temporary, isolated) ===
    step.log(`Creating isolated working copy for push ${action.id}...`);

    await cloneWorkingCopy(bareRepo, `${workCopy}/${action.repoName}`, step);

    timer.mark('Working copy ready');

    // Set action path to working copy
    action.proxyGitPath = workCopy;

    const completedMsg = bareExists
      ? `Completed fetch + local clone (hybrid cache)`
      : `Completed bare clone + local clone (hybrid cache)`;

    step.log(completedMsg);
    step.setContent(completedMsg);

    // End timing
    timer.end();

    // Enforce cache limits (LRU eviction on bare cache)
    const evictionResult = cacheManager.enforceLimits();
    if (evictionResult.removedRepos.length > 0) {
      step.log(
        `LRU evicted ${evictionResult.removedRepos.length} bare repos, freed ${evictionResult.freedMB}MB`,
      );
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
