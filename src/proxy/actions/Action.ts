import { getProxyUrl } from "../../config";
import { Step } from "./Step";

/**
 * Represents a commit.
 */
export interface Commit {
  message: string;
  committer: string;
  tree: string;
  parent: string;
  author: string;
  authorEmail: string;
  commitTS?: string; // TODO: Normalize this to commitTimestamp
  commitTimestamp?: string;
}

/**
 * Class representing a Push.
 */
class Action {
  steps: Step[] = [];
  error: boolean = false;
  errorMessage?: string | null;
  blocked: boolean = false;
  blockedMessage?: string | null;
  allowPush: boolean = false;
  authorised: boolean = false;
  canceled: boolean = false;
  rejected: boolean = false;
  commitData?: Commit[] = [];
  commitFrom?: string;
  commitTo?: string;
  branch?: string;
  message?: string;
  author?: string;
  user?: string;
  attestation?: string;
  lastStep?: Step;
  id: string;
  type: string;
  method: string;
  timestamp: number;
  project: string;
  repoName: string;
  url: string;
  repo: string;

  /**
   * Create an action.
   * @param {string} id The id of the action
   * @param {string} type The type of the action
   * @param {string} method The method of the action
   * @param {number} timestamp The timestamp of the action
   * @param {string} repo The repo of the action
   */
  constructor(id: string, type: string, method: string, timestamp: number, repo: string) {
    this.id = id;
    this.type = type;
    this.method = method;
    this.timestamp = timestamp;
    this.project = repo.split("/")[0];
    this.repoName = repo.split("/")[1];
    this.url = `${getProxyUrl()}/${repo}`;
    this.repo = repo;
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
   * @param commitFrom the starting commit
   * @param commitTo the ending commit
   */
  setCommit(commitFrom: string, commitTo: string): void {
    this.commitFrom = commitFrom;
    this.commitTo = commitTo;
    this.id = `${commitFrom}__${commitTo}`;
  }

  /**
   * Set the branch for the action.
   * @param branch the branch
   */
  setBranch(branch: string): void {
    this.branch = branch;
  }

  /**
   * Set the message for the action.
   * @param message the message
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
   * Check if the action can continue.
   * @return {boolean} true if the action can continue, false otherwise
   */
  continue(): boolean {
    return !(this.error || this.blocked);
  }
}

export { Action };
