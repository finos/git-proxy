import { AttestationData } from '../ui/views/PushDetails/attestation.types';

export interface UserData {
  id: string;
  name: string;
  username: string;
  email?: string;
  displayName?: string;
  title?: string;
  gitAccount?: string;
  admin?: boolean;
}

export interface CommitData {
  commitTs?: number;
  message: string;
  committer: string;
  tree?: string;
  parent?: string;
  author: string;
  authorEmail: string;
  commitTimestamp?: number;
}

export interface PushData {
  id: string;
  url: string;
  repo: string;
  branch: string;
  commitFrom: string;
  commitTo: string;
  commitData: CommitData[];
  diff: {
    content: string;
  };
  canceled?: boolean;
  rejected?: boolean;
  authorised?: boolean;
  attestation?: AttestationData;
  autoApproved?: boolean;
  timestamp: string | Date;
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
