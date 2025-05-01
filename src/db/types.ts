export type PushQuery = {
  error: boolean;
  blocked: boolean,
  allowPush: boolean,
  authorised: boolean
};

export type UserRole = 'canPush' | 'canAuthorise';

export type Repo = {
  project: string;
  name: string;
  url: string;
  users: Record<UserRole, string[]>;
  _id: string;
};

export type User = {
  _id: string;
  username: string;
  password: string | null; // null if oidcId is set
  gitAccount: string;
  email: string;
  admin: boolean;
  oidcId: string | null;
};

export type Push = {
  id: string;
  allowPush: boolean;
  authorised: boolean;
  blocked: boolean;
  blockedMessage: string;
  branch: string;
  canceled: boolean;
  commitData: object;
  commitFrom: string;
  commitTo: string;
  error: boolean;
  method: string;
  project: string;
  rejected: boolean;
  repo: string;
  repoName: string;
  timepstamp: string;
  type: string;
  url: string;
};
