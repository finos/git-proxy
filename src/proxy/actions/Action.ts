import { processGitURLForNameAndOrg, processUrlPath } from '../routes/helper';
import { Step } from './Step';
import { Attestation, CommitData } from '../processors/types';

/**
 * Class representing a Push.
 */
class Action {
  id: string;
  type: string;
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
  attestation?: Attestation;
  lastStep?: Step;
  proxyGitPath?: string;
  newIdxFiles?: string[];
  protocol?: 'https' | 'ssh';
  sshUser?: {
    username: string;
    email?: string;
    gitAccount?: string;
    sshKeyInfo?: {
      keyType: string;
      keyData: Buffer;
    };
  };
  pullAuthStrategy?:
    | 'basic'
    | 'ssh-user-key'
    | 'ssh-service-token'
    | 'ssh-agent-forwarding'
    | 'anonymous';
  encryptedSSHKey?: string;
  sshKeyExpiry?: Date;

  /**
   * Create an action.
   * @param {string} id The id of the action
   * @param {string} type The type of the action
   * @param {string} method The method of the action
   * @param {number} timestamp The timestamp of the action
   * @param {string} url The URL to the repo that should be proxied (with protocol, origin, repo path, but not the path for the git operation).
   */
  constructor(id: string, type: string, method: string, timestamp: number, url: string) {
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
   * Set the commit range for the action.
   * @param {string} commitFrom the starting commit
   * @param {string} commitTo the ending commit
   */
  setCommit(commitFrom: string, commitTo: string): void {
    this.commitFrom = commitFrom;
    this.commitTo = commitTo;
    this.id = `${commitFrom}__${commitTo}`;
  }

  /**
   * Set the branch for the action.
   * @param {string} branch the branch
   */
  setBranch(branch: string): void {
    this.branch = branch;
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
