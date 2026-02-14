/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, it, expect } from 'vitest';
import {
  validGitRequest,
  processUrlPath,
  processGitUrl,
  processGitURLForNameAndOrg,
} from '../src/proxy/routes/helper';

const VERY_LONG_PATH =
  '/a/very/very/very/very/very//very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/long/path';

describe('url helpers and filter functions used in the proxy', () => {
  it('processUrlPath should return breakdown of a proxied path, separating the path to repository from the git operation path', () => {
    expect(
      processUrlPath('/github.com/octocat/hello-world.git/info/refs?service=git-upload-pack'),
    ).toEqual({
      repoPath: '/github.com/octocat/hello-world.git',
      gitPath: '/info/refs?service=git-upload-pack',
    });

    expect(
      processUrlPath('/gitlab.com/org/sub-org/hello-world.git/info/refs?service=git-upload-pack'),
    ).toEqual({
      repoPath: '/gitlab.com/org/sub-org/hello-world.git',
      gitPath: '/info/refs?service=git-upload-pack',
    });

    expect(
      processUrlPath('/123.456.789/hello-world.git/info/refs?service=git-upload-pack'),
    ).toEqual({
      repoPath: '/123.456.789/hello-world.git',
      gitPath: '/info/refs?service=git-upload-pack',
    });
  });

  it('processUrlPath should return breakdown of a legacy proxy path, separating the path to repository from the git operation path', () => {
    expect(processUrlPath('/octocat/hello-world.git/info/refs?service=git-upload-pack')).toEqual({
      repoPath: '/octocat/hello-world.git',
      gitPath: '/info/refs?service=git-upload-pack',
    });
  });

  it('processUrlPath should return breakdown of a legacy proxy path, separating the path to repository when git path is just /', () => {
    expect(processUrlPath('/octocat/hello-world.git/')).toEqual({
      repoPath: '/octocat/hello-world.git',
      gitPath: '/',
    });
  });

  it('processUrlPath should return breakdown of a legacy proxy path, separating the path to repository when no path is present', () => {
    expect(processUrlPath('/octocat/hello-world.git')).toEqual({
      repoPath: '/octocat/hello-world.git',
      gitPath: '/',
    });
  });

  it("processUrlPath should return null if it can't be parsed", () => {
    expect(processUrlPath('/octocat/hello-world')).toBeNull();
    expect(processUrlPath(VERY_LONG_PATH)).toBeNull();
  });

  it('processGitUrl should return breakdown of a git URL separating out the protocol, host and repository path', () => {
    expect(processGitUrl('https://somegithost.com/octocat/hello-world.git')).toEqual({
      protocol: 'https://',
      host: 'somegithost.com',
      repoPath: '/octocat/hello-world.git',
    });

    expect(processGitUrl('https://123.456.789:1234/hello-world.git')).toEqual({
      protocol: 'https://',
      host: '123.456.789:1234',
      repoPath: '/hello-world.git',
    });
  });

  it('processGitUrl should return breakdown of a git URL separating out the protocol, host and repository path and discard any git operation path', () => {
    expect(
      processGitUrl(
        'https://somegithost.com:1234/octocat/hello-world.git/info/refs?service=git-upload-pack',
      ),
    ).toEqual({
      protocol: 'https://',
      host: 'somegithost.com:1234',
      repoPath: '/octocat/hello-world.git',
    });

    expect(
      processGitUrl('https://123.456.789/hello-world.git/info/refs?service=git-upload-pack'),
    ).toEqual({
      protocol: 'https://',
      host: '123.456.789',
      repoPath: '/hello-world.git',
    });
  });

  it('processGitUrl should return null for a url it cannot parse', () => {
    expect(processGitUrl('somegithost.com:1234/octocat/hello-world.git')).toBeNull();
    expect(processUrlPath('somegithost.com:1234' + VERY_LONG_PATH + '.git')).toBeNull();
  });

  it('processGitURLForNameAndOrg should return breakdown of a git URL path separating out the protocol, origin and repository path', () => {
    expect(processGitURLForNameAndOrg('github.com/octocat/hello-world.git')).toEqual({
      project: 'octocat',
      repoName: 'hello-world.git',
    });
  });

  it('processGitURLForNameAndOrg should return breakdown of a git repository URL separating out the project (organisation) and repository name', () => {
    expect(processGitURLForNameAndOrg('https://github.com:80/octocat/hello-world.git')).toEqual({
      project: 'octocat',
      repoName: 'hello-world.git',
    });
  });

  it("processGitURLForNameAndOrg should return null for a git repository URL it can't parse", () => {
    expect(processGitURLForNameAndOrg('someGitHost.com/repo')).toBeNull();
    expect(processGitURLForNameAndOrg('https://someGitHost.com/repo')).toBeNull();
    expect(
      processGitURLForNameAndOrg('https://somegithost.com:1234' + VERY_LONG_PATH + '.git'),
    ).toBeNull();
  });

  it('validGitRequest should return true for safe requests', () => {
    [
      '/info/refs?service=git-upload-pack',
      '/info/refs?service=git-receive-pack',
      '/git-upload-pack',
      '/git-receive-pack',
    ].forEach((url) => {
      expect(
        validGitRequest(url, {
          'user-agent': 'git/2.30.0',
          accept: 'application/x-git-upload-pack-request',
        }),
      ).toBe(true);
    });
  });

  it('validGitRequest should return false for unsafe URLs', () => {
    ['/', '/foo'].forEach((url) => {
      expect(
        validGitRequest(url, {
          'user-agent': 'git/2.30.0',
          accept: 'application/x-git-upload-pack-request',
        }),
      ).toBe(false);
    });
  });

  it('validGitRequest should return false for a browser request', () => {
    expect(
      validGitRequest('/', {
        'user-agent': 'Mozilla/5.0',
        accept: '*/*',
      }),
    ).toBe(false);
  });

  it('validGitRequest should return false for unexpected headers', () => {
    expect(
      validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.30.0',
        accept: '*/*',
      }),
    ).toBe(false);

    expect(
      validGitRequest('/info/refs?service=git-upload-pack', {
        'user-agent': 'Mozilla/5.0',
        accept: '*/*',
      }),
    ).toBe(false);
  });

  it('validGitRequest should return false for unexpected content-type', () => {
    ['application/json', 'text/html', '*/*'].forEach((accept) => {
      expect(
        validGitRequest('/git-upload-pack', {
          'user-agent': 'git/2.30.0',
          accept,
        }),
      ).toBe(false);
    });
  });
});
