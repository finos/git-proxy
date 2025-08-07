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

export interface TagData {
  object?: string;
  type: string; // commit | tree | blob | tag or 'lightweight' | 'annotated' for legacy
  tagName: string;
  tagger: string;
  taggerEmail?: string;
  timestamp?: string;
  message: string;
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
  // Tag-specific fields
  tag?: string;
  tagData?: TagData[];
  user?: string; // Used for tag pushes as the tagger
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
