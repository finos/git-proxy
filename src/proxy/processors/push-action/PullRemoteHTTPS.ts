import { Action, Step } from '../../actions';
import { PullRemoteBase, CloneResult } from './PullRemoteBase';
import fs from 'fs';
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';

type BasicCredentials = {
  username: string;
  password: string;
};

/**
 * HTTPS implementation of pull remote
 * Uses isomorphic-git for cloning over HTTPS
 */
export class PullRemoteHTTPS extends PullRemoteBase {
  /**
   * Decode HTTP Basic Authentication header
   */
  private decodeBasicAuth(authHeader?: string): BasicCredentials | null {
    if (!authHeader) {
      return null;
    }

    const [scheme, encoded] = authHeader.split(' ');
    if (!scheme || !encoded || scheme.toLowerCase() !== 'basic') {
      throw new Error('Invalid Authorization header format');
    }

    const credentials = Buffer.from(encoded, 'base64').toString();
    const separatorIndex = credentials.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error('Invalid Authorization header credentials');
    }

    return {
      username: credentials.slice(0, separatorIndex),
      password: credentials.slice(separatorIndex + 1),
    };
  }

  /**
   * Perform HTTPS clone
   */
  protected async performClone(req: any, action: Action, step: Step): Promise<CloneResult> {
    // Decode client credentials
    const credentials = this.decodeBasicAuth(req.headers?.authorization);
    if (!credentials) {
      throw new Error('Missing Authorization header for HTTPS clone');
    }

    step.log('Cloning repository over HTTPS using client credentials');

    // Note: setting singleBranch to true will cause issues when pushing to
    // a non-default branch as commits from those branches won't be fetched
    const cloneOptions: any = {
      fs,
      http: gitHttpClient,
      url: action.url,
      dir: `${action.proxyGitPath}/${action.repoName}`,
      depth: 1,
      onAuth: () => credentials,
    };

    await git.clone(cloneOptions);

    return {
      command: `git clone ${action.url}`,
      strategy: 'basic',
    };
  }
}
