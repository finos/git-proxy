import { Action } from "../actions";

export interface Processor {
  exec(req: any, action: Action): Promise<Action>;
  metadata: ProcessorMetadata;
}

export interface ProcessorMetadata {
  displayName: string;
}

export type CommitContent = {
  item: number;
  value: number;
  type: number;
  size: number;
  deflatedSize: number;
  objectRef: any;
  content: string;
}

export type PersonLine = {
  name: string;
  email: string;
  timestamp: string;
}

export type CommitHeader = {
  tree: string;
  parents: string[];
  author: PersonLine;
  committer: PersonLine;
}

export type CommitData = {
  tree: string;
  parent: string;
  author: string;
  committer: string;
  authorEmail: string;
  commitTimestamp: string;
  message: string;
}

export type PackMeta = {
  sig: string;
  version: number;
  entries: number;
}
