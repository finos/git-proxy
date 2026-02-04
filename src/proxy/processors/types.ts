import { Request } from 'express';

import { Question } from '../../config/generated/config';
import { Action } from '../actions';

export interface Processor {
  exec(req: Request, action: Action): Promise<Action>;
  metadata: ProcessorMetadata;
}

export interface ProcessorMetadata {
  displayName: string;
}

export type Attestation = {
  reviewer: {
    username: string;
    email: string;
  };
  timestamp: string | Date;
  questions: Question[];
  automated?: boolean;
};

export type CommitContent = {
  item: number;
  type: number;
  typeName: string;
  size: number;
  baseSha: string | null;
  baseOffset: number | null;
  content: string;
};

export type PersonLine = {
  name: string;
  email: string;
  timestamp: string;
};

export type CommitHeader = {
  tree: string;
  parents: string[];
  author: PersonLine;
  committer: PersonLine;
};

export type CommitData = {
  tree: string;
  parent: string;
  author: string;
  committer: string;
  authorEmail: string;
  committerEmail: string;
  commitTimestamp: string;
  message: string;
};

export type PackMeta = {
  sig: string;
  version: number;
  entries: number;
};
