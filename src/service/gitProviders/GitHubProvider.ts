/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios, { AxiosRequestConfig } from 'axios';
import { GITHUB_API, GH_ACCEPT, USER_AGENT } from './githubAuth';
import type { GitProvider, SCMRepositoryMetadata } from './GitProvider';

interface GitHubRepoResponse {
  description?: string;
  language?: string;
  license?: { spdx_id: string };
  html_url: string;
  owner?: { avatar_url: string; html_url: string };
  parent?: { full_name: string; html_url: string };
}

function mapToScmMetadata(data: GitHubRepoResponse): SCMRepositoryMetadata {
  return {
    description: data.description,
    language: data.language,
    license: data.license?.spdx_id,
    htmlUrl: data.html_url,
    parentName: data.parent?.full_name,
    parentUrl: data.parent?.html_url,
    avatarUrl: data.owner?.avatar_url,
    profileUrl: data.owner?.html_url,
  };
}

const publicGithubConfig: AxiosRequestConfig = {
  headers: {
    Accept: GH_ACCEPT,
    'User-Agent': USER_AGENT,
  },
  validateStatus: () => true,
};

async function fetchRepo(project: string, name: string): Promise<GitHubRepoResponse | null> {
  const response = await axios.get<GitHubRepoResponse>(
    `${GITHUB_API}/repos/${encodeURIComponent(project)}/${encodeURIComponent(name)}`,
    publicGithubConfig,
  );
  if (response.status !== 200) {
    return null;
  }
  return response.data;
}

export class GitHubProvider implements GitProvider {
  async getMetadata(project: string, name: string): Promise<SCMRepositoryMetadata | null> {
    try {
      const repo = await fetchRepo(project, name);
      return repo ? mapToScmMetadata(repo) : null;
    } catch {
      return null;
    }
  }
}
