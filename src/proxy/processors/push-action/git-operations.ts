import { spawnSync } from 'child_process';
import fs from 'fs';

/**
 * Git operations using native git commands
 */

/**
 * Build URL with credentials if provided
 */
function buildAuthUrl(url: string, username?: string, password?: string): string {
  if (username && password) {
    return url.replace(
      /^(https?:\/\/)/,
      `$1${encodeURIComponent(username)}:${encodeURIComponent(password)}@`,
    );
  }
  return url;
}

interface CloneOptions {
  dir: string;
  url: string;
  username?: string;
  password?: string;
  bare?: boolean;
  depth?: number;
  singleBranch?: boolean;
}

interface FetchOptions {
  dir: string;
  url: string;
  username?: string;
  password?: string;
  depth?: number;
  prune?: boolean;
  bare?: boolean;
}

/**
 * Clone a repository using native git
 */
export async function clone(options: CloneOptions): Promise<void> {
  const { dir, url, username, password, bare = false, depth, singleBranch = false } = options;

  const authUrl = buildAuthUrl(url, username, password);

  const args: string[] = ['clone'];

  if (bare) {
    args.push('--bare');
  }

  if (depth) {
    args.push('--depth', depth.toString());
  }

  if (singleBranch) {
    args.push('--single-branch');
  } else {
    // Explicitly clone all branches (needed when using --depth)
    args.push('--no-single-branch');
  }

  args.push(authUrl, dir);

  const result = spawnSync('git', args, { stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`Git clone failed: ${result.stderr?.toString() || 'Unknown error'}`);
  }

  // Sanitize credentials from git config
  if (username && password) {
    sanitizeCredentials(dir, url, bare);
  }
}

/**
 * Fetch updates in a repository using native git
 */
export async function fetch(options: FetchOptions): Promise<void> {
  const { dir, url, username, password, depth, prune = false, bare = false } = options;

  const authUrl = buildAuthUrl(url, username, password);

  const args: string[] = ['-C', dir, 'fetch'];

  if (depth) {
    args.push('--depth', depth.toString());
  }

  if (prune) {
    args.push('--prune');
  }

  args.push(authUrl);
  args.push('+refs/heads/*:refs/heads/*'); // Fetch all branches

  const result = spawnSync('git', args, { stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`Git fetch failed: ${result.stderr?.toString() || 'Unknown error'}`);
  }

  // Sanitize credentials from git config
  if (username && password) {
    sanitizeCredentials(dir, url, bare);
  }
}

/**
 * Remove credentials from git config and set clean URL
 */
function sanitizeCredentials(dir: string, cleanUrl: string, isBare: boolean): void {
  try {
    // For bare repositories, git clone --bare doesn't set up a remote by default
    // We need to add it first if it doesn't exist
    if (isBare) {
      let result = spawnSync('git', ['-C', dir, 'remote', 'add', 'origin', cleanUrl], {
        stdio: 'pipe',
      });
      if (result.status !== 0) {
        // If remote already exists, update it
        result = spawnSync('git', ['-C', dir, 'remote', 'set-url', 'origin', cleanUrl], {
          stdio: 'pipe',
        });
        if (result.status !== 0) {
          throw new Error(`Failed to set remote: ${result.stderr?.toString()}`);
        }
      }
    } else {
      // For non-bare repositories, remote origin should exist
      // Unset the URL with credentials (ignore error if already unset)
      spawnSync('git', ['-C', dir, 'config', '--unset', 'remote.origin.url'], {
        stdio: 'pipe',
      });

      // Set clean URL without credentials
      const result = spawnSync('git', ['-C', dir, 'remote', 'set-url', 'origin', cleanUrl], {
        stdio: 'pipe',
      });
      if (result.status !== 0) {
        throw new Error(`Failed to set remote: ${result.stderr?.toString()}`);
      }
    }
  } catch (e) {
    console.warn(`Warning: Failed to sanitize credentials for ${dir}:`, e);
  }
}

/**
 * Clone from local repository (for working copy from bare cache)
 */
export async function cloneLocal(options: {
  sourceDir: string;
  targetDir: string;
  depth?: number;
}): Promise<void> {
  const { sourceDir, targetDir, depth } = options;

  const args: string[] = ['clone'];

  if (depth) {
    args.push('--depth', depth.toString());
  }

  args.push(sourceDir, targetDir);

  const result = spawnSync('git', args, { stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`Git local clone failed: ${result.stderr?.toString() || 'Unknown error'}`);
  }
}
