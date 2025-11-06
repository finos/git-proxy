import { Action } from '../proxy/actions';
import { Step } from '../proxy/actions/Step';

export interface PushActionView extends Action {
  diff: Step;
}

export interface RepositoryData {
  _id?: string;
  project: string;
  name: string;
  url: string;
  maxUser: number;
  lastModified?: string;
  dateCreated?: string;
  proxyURL?: string;
  users?: {
    canPush?: string[];
    canAuthorise?: string[];
  };
}

export type RepositoryDataWithId = Required<Pick<RepositoryData, '_id'>> & RepositoryData;

interface QuestionTooltipLink {
  text: string;
  url: string;
}

interface QuestionTooltip {
  text: string;
  links?: QuestionTooltipLink[];
}

export interface QuestionFormData {
  label: string;
  checked: boolean;
  tooltip: QuestionTooltip;
}

interface Reviewer {
  username: string;
  gitAccount: string;
}

export interface AttestationFormData {
  reviewer: Reviewer;
  timestamp: string | Date;
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

export interface UserContextType {
  user: {
    admin: boolean;
  };
}
