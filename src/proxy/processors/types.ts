/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Question } from '../../config/generated/config';
import { Action } from '../actions';

export interface Processor {
  exec(req: any, action: Action): Promise<Action>;
  metadata: ProcessorMetadata;
}

export interface ProcessorMetadata {
  displayName: string;
}

export type Attestation = {
  reviewer: {
    username: string;
    gitAccount: string;
  };
  timestamp: string | Date;
  questions: Question[];
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
