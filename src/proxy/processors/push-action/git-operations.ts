import { Step } from '../../actions';
import { cacheManager } from './cache-manager';

/**
 * Git Operations for Hybrid Cache
 */

/**
 * Execute a git command with credentials sanitization
 */
async function execGitCommand(
  command: string,
  step: Step,
  maxBuffer: number = 50 * 1024 * 1024,
): Promise<{ stdout: string; stderr: string }> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const { stdout, stderr } = await execAsync(command, { maxBuffer });

  if (stdout) step.log(stdout.trim());
  if (stderr) step.log(stderr.trim());

  return { stdout, stderr };
}

/**
 * Build URL with embedded credentials
 */
function buildUrlWithCredentials(url: string, username: string, password: string): string {
  return url.replace('://', `://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
}

/**
 * Remove credentials from bare repository config
 */
async function sanitizeRepositoryConfig(bareRepo: string, cleanUrl: string): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // Remove any URL with credentials
  await execAsync(`cd "${bareRepo}" && git config --unset remote.origin.url 2>/dev/null || true`);
  // Set clean URL without credentials
  await execAsync(`cd "${bareRepo}" && git config remote.origin.url "${cleanUrl}"`);
}

/**
 * Clone working copy from bare repository using native git
 */
export async function cloneWorkingCopy(
  bareRepo: string,
  workCopyPath: string,
  step: Step,
): Promise<void> {
  try {
    await execGitCommand(`git clone "${bareRepo}" "${workCopyPath}"`, step);
    step.log(`Working copy created at ${workCopyPath}`);
  } catch (error: any) {
    step.log(`Failed to create working copy: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch updates in bare repository using native git command
 */
export async function fetchBareRepository(
  bareRepo: string,
  url: string,
  username: string,
  password: string,
  step: Step,
): Promise<void> {
  const urlWithCreds = buildUrlWithCredentials(url, username, password);

  try {
    // Fetch all branches with depth=1
    await execGitCommand(
      `cd "${bareRepo}" && git fetch --depth=1 "${urlWithCreds}" "+refs/heads/*:refs/heads/*"`,
      step,
    );

    // SECURITY: Remove credentials from config
    await sanitizeRepositoryConfig(bareRepo, url);

    step.log(`Bare repository updated (credentials removed)`);
  } catch (error: any) {
    step.log(`Failed to fetch bare repository: ${error.message}`);
    throw error;
  }
}

/**
 * Clone bare repository using native git command
 */
export async function cloneBareRepository(
  bareRepo: string,
  url: string,
  username: string,
  password: string,
  step: Step,
): Promise<void> {
  const urlWithCreds = buildUrlWithCredentials(url, username, password);

  try {
    await execGitCommand(`git clone --bare --depth=1 "${urlWithCreds}" "${bareRepo}"`, step);

    // SECURITY: Remove credentials from config immediately after clone
    await sanitizeRepositoryConfig(bareRepo, url);

    step.log(`Bare repository created at ${bareRepo} (credentials sanitized)`);

    // Update access time for LRU after successful clone
    const repoName = bareRepo.split('/').pop() || '';
    cacheManager.touchRepository(repoName);
  } catch (error: any) {
    step.log(`Failed to clone bare repository: ${error.message}`);
    throw error;
  }
}
