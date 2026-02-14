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

import { Action } from '../proxy/actions';
import { Step } from '../proxy/actions/Step';
import { Repo } from '../db/types';
import { Attestation } from '../proxy/processors/types';
import { Question } from '../config/generated/config';

export interface PushActionView extends Action {
  diff: Step;
}

export interface RepoView extends Repo {
  proxyURL: string;
  lastModified?: string;
  dateCreated?: string;
}

export interface QuestionFormData extends Question {
  checked: boolean;
}

export interface AttestationFormData extends Attestation {
  questions: QuestionFormData[];
}

export interface Route {
  path: string;
  layout: string;
  name: string;
  rtlName?: string;
  component: React.ComponentType<any>;
  icon?: string | React.ComponentType<any>;
  visible?: boolean;
}

export interface GitHubRepositoryMetadata {
  description?: string;
  language?: string;
  license?: {
    spdx_id: string;
  };
  html_url: string;
  parent?: {
    full_name: string;
    html_url: string;
  };
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  owner?: {
    avatar_url: string;
    html_url: string;
  };
}

export interface GitLabRepositoryMetadata {
  description?: string;
  primary_language?: string;
  license?: {
    nickname: string;
  };
  web_url: string;
  forked_from_project?: {
    full_name: string;
    web_url: string;
  };
  last_activity_at?: string;
  avatar_url?: string;
  namespace?: {
    name: string;
    path: string;
    full_path: string;
    avatar_url?: string;
    web_url: string;
  };
}

export interface SCMRepositoryMetadata {
  description?: string;
  language?: string;
  license?: string;
  htmlUrl?: string;
  parentName?: string;
  parentUrl?: string;
  lastUpdated?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;

  profileUrl?: string;
  avatarUrl?: string;
}
