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

import { Action } from '../proxy/actions';
import { Step } from '../proxy/actions/Step';
import { Repo } from '../db/types';
import { Attestation } from '../proxy/processors/types';
import { Question } from '../config/generated/config';

type ActionMethods =
  | 'addStep'
  | 'getLastStep'
  | 'setCommit'
  | 'setBranch'
  | 'setMessage'
  | 'setAllowPush'
  | 'setAutoApproval'
  | 'setAutoRejection'
  | 'continue';

export interface CancellationData {
  reviewer: {
    username: string;
    displayName?: string | null;
  };
  reason?: string;
  timestamp: string | Date;
}

export interface RejectionData {
  reviewer: {
    username: string;
    displayName?: string | null;
  };
  reason: string;
  timestamp: string | Date;
}

export interface BackendResponse {
  message: string;
}

export interface PushActionView extends Omit<Action, ActionMethods> {
  diff: Step;
}

export interface RepoView extends Repo {
  proxyURL: string;
  lastModified?: string;
  dateCreated?: string;
}

export interface QuestionFormData extends Question {
  checked: boolean;
}

export interface AttestationFormData extends Attestation {
  questions: QuestionFormData[];
}

export interface Route {
  path: string;
  layout: string;
  name: string;
  rtlName?: string;
  component: React.ComponentType;
  visible?: boolean;
}

export interface SCMRepositoryMetadata {
  description?: string;
  language?: string;
  license?: string;
  htmlUrl?: string;
  parentName?: string;
  parentUrl?: string;
  profileUrl?: string;
  avatarUrl?: string;
}

export type CSSProperty = React.CSSProperties;
