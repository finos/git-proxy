/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

export interface AttestationAnswer {
  label: string;
  checked: boolean;
}

type AttestationBase = {
  reviewer: {
    username: string;
    email: string;
  };
  timestamp: string | Date;
  automated?: boolean;
};

export type Attestation = AttestationBase & {
  questions: Question[];
};

export type CompletedAttestation = AttestationBase & {
  answers: AttestationAnswer[];
};

export type Rejection = AttestationBase & {
  reason: string;
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
