import { CSSProperties } from '@material-ui/core/styles/withStyles';

import { Action } from '../proxy/actions';
import { Step } from '../proxy/actions/Step';
import { Repo } from '../db/types';
import { Attestation } from '../proxy/processors/types';
import { Question } from '../config/generated/config';

export interface BackendResponse {
  message: string;
}

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
  component: React.ComponentType;
  icon?: string | React.ComponentType;
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

export type CSSProperty = React.CSSProperties | CSSProperties;
