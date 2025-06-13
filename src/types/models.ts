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
