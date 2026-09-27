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

import { createHash } from 'crypto';

import { processGitURLForNameAndOrg, processUrlPath } from '../routes/helper';
import { Step } from './Step';
import { CompletedAttestation, CommitData, Rejection } from '../processors/types';
import { TagData } from '../../types/models';

export enum RequestType {
  PUSH = 'push',

  PULL = 'pull',

  DEFAULT = 'default',
}

export enum PushType {
  /** Push to a tag ref (refs/tags/*) */
  TAG = 'tag',

  /** Push to a branch ref (refs/heads/*) or any other non-tag ref */
  BRANCH = 'branch',
}

export type PushIdParts = {
  url: string;
  branch?: string;
  tags?: string[];
  commitFrom: string;
  commitTo: string;
};

/**
 * Build the push ID based on to/from commits, repo, refs and tags.
 *
 * @param {PushIdParts} parts Parts that identify the push
 * @return {string} A sha256 hash of the push
 */
export const buildPushId = (parts: PushIdParts): string => {
  const tags = [...(parts.tags ?? [])].sort();
  const material = [
    parts.url,
    parts.branch ?? '',
    tags.join('\n'),
    parts.commitFrom,
    parts.commitTo,
  ].join('\0');
  return createHash('sha256').update(material).digest('hex');
};

/**
 * Class representing a Push.
 */
class Action {
  id: string;
  legacyId?: string; // "commitFrom__commitTo" id for legacy pushes
  type: RequestType;
  actionType?: PushType;
  method: string;
  timestamp: number;
  project: string;
  repoName: string;
  url: string;
  repo: string;
  steps: Step[] = [];
  error: boolean = false;
  errorMessage?: string | null;
  blocked: boolean = false;
  blockedMessage?: string | null;
  allowPush: boolean = false;
  authorised: boolean = false;
  canceled: boolean = false;
  rejected: boolean = false;
  autoApproved: boolean = false;
  autoRejected: boolean = false;
  commitData?: CommitData[] = [];
  commitFrom?: string;
  commitTo?: string;
  branch?: string;
  message?: string;
  author?: string;
  user?: string;
  userEmail?: string;
  /** Set only when `user` came from a session or a credential the SCM vouched for; never from pushed objects. */
  pusherVerified?: boolean;
  attestation?: CompletedAttestation;
  rejection?: Rejection;
  lastStep?: Step;
  proxyGitPath?: string;
  tags?: string[]; // legacy records can contain multiple tags
  tagData?: TagData[];
  newIdxFiles?: string[];
  protocol?: 'https' | 'ssh';
  capabilities?: string[];
  pullAuthStrategy?:
    'basic' | 'ssh-user-key' | 'ssh-service-token' | 'ssh-agent-forwarding' | 'anonymous';

  /**
   * Create an action.
   * @param {string} id The id of the action
   * @param {string} type The type of the action
   * @param {string} method The method of the action
   * @param {number} timestamp The timestamp of the action
   * @param {string} url The URL to the repo that should be proxied (with protocol, origin, repo path, but not the path for the git operation).
   */
  constructor(id: string, type: RequestType, method: string, timestamp: number, url: string) {
    this.id = id;
    this.type = type;
    this.method = method;
    this.timestamp = timestamp;
    this.url = url;

    const urlBreakdown = processUrlPath(url);
    if (urlBreakdown) {
      this.repo = urlBreakdown.repoPath;
      const repoBreakdown = processGitURLForNameAndOrg(urlBreakdown.repoPath);
      this.project = repoBreakdown?.project ?? '';
      this.repoName = repoBreakdown?.repoName ?? '';
    } else {
      this.repo = 'NOT-FOUND';
      this.project = 'UNKNOWN';
      this.repoName = 'UNKNOWN';
    }
  }

  /**
   * Add a step to the action.
   * @param {Step} step
   */
  addStep(step: Step): void {
    this.steps.push(step);
    this.lastStep = step;

    if (step.blocked) {
      this.blocked = true;
      this.blockedMessage = step.blockedMessage;
    }

    if (step.error) {
      this.error = true;
      this.errorMessage = step.errorMessage;
    }
  }

  /**
   * Get the last step of the action.
   * @return {Step} The last step of the action
   */
  getLastStep(): Step | undefined {
    return this.lastStep;
  }

  /**
   * Set the commit range for the action. Changes the action.id to be based on
   * commit details and repo/ref details from the push.
   * @param {string} commitFrom the starting commit
   * @param {string} commitTo the ending commit
   */
  setCommit(commitFrom: string, commitTo: string): void {
    this.commitFrom = commitFrom;
    this.commitTo = commitTo;
    this.id = buildPushId({
      url: this.url,
      branch: this.branch,
      tags: this.tags,
      commitFrom,
      commitTo,
    });
  }

  /**
   * Set the branch for the action. Also recomputes the push ID
   * if commit range is known.
   *
   * @param {string} branch the branch
   */
  setBranch(branch: string): void {
    this.branch = branch;
    // if commit range is known, recompute appropriate push ID
    if (this.commitFrom !== undefined && this.commitTo !== undefined) {
      this.id = buildPushId({
        url: this.url,
        branch: this.branch,
        tags: this.tags,
        commitFrom: this.commitFrom,
        commitTo: this.commitTo,
      });
    }
  }

  /**
   * Set the message for the action.
   * @param {string} message the message
   */
  setMessage(message: string): void {
    this.message = message;
  }

  /**
   * Allow the action to continue.
   */
  setAllowPush(): void {
    this.allowPush = true;
    this.blocked = false;
  }

  /**
   * Set auto approval for the action.
   */
  setAutoApproval(): void {
    this.autoApproved = true;
  }

  /**
   * Set auto rejection for the action.
   */
  setAutoRejection(): void {
    this.autoRejected = true;
  }

  /**
   * Check if the action can continue.
   * @return {boolean} true if the action can continue, false otherwise
   */
  continue(): boolean {
    return !(this.error || this.blocked);
  }
}

export { Action };
