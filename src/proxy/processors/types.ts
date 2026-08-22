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

export interface ProcessorExec {
  (req: Request, action: Action): Promise<Action>;
  /** Used for progress and step reporting (e.g. 'checkMessages.exec'). */
  readonly displayName?: string;
  /**
   * Failures in collectible steps are recoverable by the user. Failures are
   * recorded and all rejection reasons are reported at the end of the chain.
   * When false or unset, a failure stops the chain immediately.
   */
  readonly isCollectible?: boolean;
}

/**
 * A single element of a chain. Can be a processor function, a push phase, or a pull phase.
 */
export type ChainElement = ProcessorExec | PushPhase | PullPhase;

export interface BuiltChains {
  branch: ProcessorExec[];
  tag: ProcessorExec[];
  pull: ProcessorExec[];
  default: ProcessorExec[];
}

export const PushPhase = {
  AFTER_PERMISSIONS: 'AFTER_PERMISSIONS',
  AFTER_CHECKOUT: 'AFTER_CHECKOUT',
  AFTER_DIFF: 'AFTER_DIFF',
  BEFORE_APPROVAL: 'BEFORE_APPROVAL',
};
export type PushPhase = (typeof PushPhase)[keyof typeof PushPhase];

export const PullPhase = {
  AFTER_AUTHORISATION: 'AFTER_AUTHORISATION',
};
export type PullPhase = (typeof PullPhase)[keyof typeof PullPhase];

export type PushChainName = 'tag' | 'branch';

export interface Processor {
  exec: ProcessorExec;
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
    /** Optional friendly name; absent on records written by the proxy itself. */
    displayName?: string | null;
    /** Legacy alias for `email` on attestations persisted by older versions. */
    reviewerEmail?: string;
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
  /** Not derived by `getCommitData`; present only on pushes recorded with a per-commit hash. */
  sha?: string;
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
