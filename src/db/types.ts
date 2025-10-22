import { Action } from '../proxy/actions/Action';
import MongoDBStore from 'connect-mongo';

export type PushQuery = {
  error: boolean;
  blocked: boolean;
  allowPush: boolean;
  authorised: boolean;
  type: string;
  [key: string]: QueryValue;
  canceled: boolean;
  rejected: boolean;
};

export type RepoQuery = {
  name: string;
  url: string;
  project: string;
  [key: string]: QueryValue;
};

export type UserQuery = {
  username: string;
  email: string;
  [key: string]: QueryValue;
};

export type QueryValue = string | boolean | number | undefined;

export type UserRole = 'canPush' | 'canAuthorise';

export class Repo {
  project: string;
  name: string;
  url: string;
  users: { canPush: string[]; canAuthorise: string[] };
  _id?: string;

  constructor(
    project: string,
    name: string,
    url: string,
    users?: Record<UserRole, string[]>,
    _id?: string,
  ) {
    this.project = project;
    this.name = name;
    this.url = url;
    this.users = users ?? { canPush: [], canAuthorise: [] };
    this._id = _id;
  }
}

export class User {
  username: string;
  password: string | null; // null if oidcId is set
  gitAccount: string;
  email: string;
  admin: boolean;
  oidcId?: string | null;
  displayName?: string | null;
  title?: string | null;
  _id?: string;

  constructor(
    username: string,
    password: string,
    gitAccount: string,
    email: string,
    admin: boolean,
    oidcId: string | null = null,
    _id?: string,
  ) {
    this.username = username;
    this.password = password;
    this.gitAccount = gitAccount;
    this.email = email;
    this.admin = admin;
    this.oidcId = oidcId ?? null;
    this._id = _id;
  }
}

export interface Sink {
  getSessionStore: () => MongoDBStore | undefined;
  getPushes: (query: Partial<PushQuery>) => Promise<Action[]>;
  writeAudit: (action: Action) => Promise<void>;
  getPush: (id: string) => Promise<Action | null>;
  deletePush: (id: string) => Promise<void>;
  authorise: (id: string, attestation: any) => Promise<{ message: string }>;
  cancel: (id: string) => Promise<{ message: string }>;
  reject: (id: string, attestation: any) => Promise<{ message: string }>;
  getRepos: (query?: Partial<RepoQuery>) => Promise<Repo[]>;
  getRepo: (name: string) => Promise<Repo | null>;
  getRepoByUrl: (url: string) => Promise<Repo | null>;
  getRepoById: (_id: string) => Promise<Repo | null>;
  createRepo: (repo: Repo) => Promise<Repo>;
  addUserCanPush: (_id: string, user: string) => Promise<void>;
  addUserCanAuthorise: (_id: string, user: string) => Promise<void>;
  removeUserCanPush: (_id: string, user: string) => Promise<void>;
  removeUserCanAuthorise: (_id: string, user: string) => Promise<void>;
  deleteRepo: (_id: string) => Promise<void>;
  findUser: (username: string) => Promise<User | null>;
  findUserByEmail: (email: string) => Promise<User | null>;
  findUserByOIDC: (oidcId: string) => Promise<User | null>;
  getUsers: (query?: Partial<UserQuery>) => Promise<User[]>;
  createUser: (user: User) => Promise<void>;
  deleteUser: (username: string) => Promise<void>;
  updateUser: (user: Partial<User>) => Promise<void>;
}
