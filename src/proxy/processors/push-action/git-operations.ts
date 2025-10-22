import { execSync } from 'child_process';
import fs from 'fs';

/**
 * Git operations using native git commands
 */

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

  // Build URL with credentials if provided
  let authUrl = url;
  if (username && password) {
    authUrl = url.replace(
      /^(https?:\/\/)/,
      `$1${encodeURIComponent(username)}:${encodeURIComponent(password)}@`,
    );
  }

  const args: string[] = ['git', 'clone'];

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

  args.push(`"${authUrl}"`, `"${dir}"`);

  execSync(args.join(' '), { stdio: 'pipe' });

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

  // Build URL with credentials if provided
  let authUrl = url;
  if (username && password) {
    authUrl = url.replace(
      /^(https?:\/\/)/,
      `$1${encodeURIComponent(username)}:${encodeURIComponent(password)}@`,
    );
  }

  const args: string[] = ['git', '-C', `"${dir}"`, 'fetch'];

  if (depth) {
    args.push('--depth', depth.toString());
  }

  if (prune) {
    args.push('--prune');
  }

  args.push(`"${authUrl}"`);
  args.push('"+refs/heads/*:refs/heads/*"'); // Fetch all branches

  execSync(args.join(' '), { stdio: 'pipe' });

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
      try {
        execSync(`git -C "${dir}" remote add origin "${cleanUrl}"`, { stdio: 'pipe' });
      } catch (e) {
        // If remote already exists, update it
        execSync(`git -C "${dir}" remote set-url origin "${cleanUrl}"`, { stdio: 'pipe' });
      }
    } else {
      // For non-bare repositories, remote origin should exist
      try {
        // Unset the URL with credentials
        execSync(`git -C "${dir}" config --unset remote.origin.url`, { stdio: 'pipe' });
      } catch (e) {
        // Ignore error if already unset
      }

      // Set clean URL without credentials
      execSync(`git -C "${dir}" remote set-url origin "${cleanUrl}"`, { stdio: 'pipe' });
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

  const args: string[] = ['git', 'clone'];

  if (depth) {
    args.push('--depth', depth.toString());
  }

  args.push(`"${sourceDir}"`, `"${targetDir}"`);

  execSync(args.join(' '), { stdio: 'pipe' });
}
