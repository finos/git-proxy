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
import { USER_AGENT } from './githubAuth';
import type { GitProvider, SCMRepositoryMetadata } from './GitProvider';

interface GitLabRepoResponse {
  description?: string;
  license?: { nickname: string };
  web_url: string;
  forked_from_project?: { full_name: string; web_url: string };
  avatar_url?: string;
  namespace?: { web_url: string };
}

function gitlabConfig(): AxiosRequestConfig {
  return {
    headers: { 'User-Agent': USER_AGENT },
    validateStatus: () => true,
  };
}

export class GitLabProvider implements GitProvider {
  constructor(private readonly hostname: string) {}

  async getMetadata(project: string, name: string): Promise<SCMRepositoryMetadata | null> {
    const projectPath = encodeURIComponent(`${project}/${name}`);
    const base = `https://${this.hostname}`;
    const config = gitlabConfig();

    try {
      const response = await axios.get<GitLabRepoResponse>(
        `${base}/api/v4/projects/${projectPath}`,
        config,
      );
      if (response.status !== 200) {
        return null;
      }

      let primaryLanguage: string | undefined;
      try {
        const languagesResponse = await axios.get<Record<string, number>>(
          `${base}/api/v4/projects/${projectPath}/languages`,
          config,
        );
        if (languagesResponse.status === 200 && languagesResponse.data) {
          primaryLanguage = Object.keys(languagesResponse.data)[0];
        }
      } catch {
        /* optional enrichment */
      }

      const data = response.data;
      return {
        description: data.description,
        language: primaryLanguage,
        license: data.license?.nickname,
        htmlUrl: data.web_url,
        parentName: data.forked_from_project?.full_name,
        parentUrl: data.forked_from_project?.web_url,
        avatarUrl: data.avatar_url,
        profileUrl: data.namespace?.web_url,
      };
    } catch {
      return null;
    }
  }
}
