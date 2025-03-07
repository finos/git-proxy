/** Class representing a Push. */
import { getProxyUrl } from "../../config";
import { Step } from "./Step";

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
   * Add a step to the action
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

  getLastStep(): Step | undefined {
    return this.lastStep;
  }

  setCommit(commitFrom: string, commitTo: string): void {
    this.commitFrom = commitFrom;
    this.commitTo = commitTo;
    this.id = `${commitFrom}__${commitTo}`;
  }

  setBranch(branch: string): void {
    this.branch = branch;
  }

  setMessage(message: string): void {
    this.message = message;
  }

  setAllowPush(): void {
    this.allowPush = true;
    this.blocked = false;
  }

  continue(): boolean {
    return !(this.error || this.blocked);
  }
}

export { Action };
