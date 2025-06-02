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

export interface Commit {
  commitTs?: number;
  message: string;
  committer: string;
  tree?: string;
  parent?: string;
  author: string;
  authorEmail: string;
  commitTimestamp?: number;
}
