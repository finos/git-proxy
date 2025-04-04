/** Class representing a Push. */
const config = require('../../config');

/**
 * Create a new action
 */
class Action {
  steps = [];
  error = false;
  errorMessage;
  blocked = false;
  blockedMessage;
  allowPush = false;
  authorised = false;
  canceled = false;
  rejected = false;
  autoApproved = false;
  autoRejected = false;
  commitFrom;
  commitTo;
  branch;
  message;
  author;
  user;
  attestation;

  /**
   *
   * @param {*} id
   * @param {*} type
   * @param {*} method
   * @param {*} timestamp
   * @param {*} repo
   */
  constructor(id, type, method, timestamp, repo) {
    this.id = id;
    this.type = type;
    this.method = method;
    this.timestamp = timestamp;
    this.project = repo.split('/')[0];
    this.repoName = repo.split('/')[1];
    this.url = `${config.getProxyUrl()}/${repo}`;
    this.repo = repo;
  }

  /**
   *
   * @param {*} step
   */
  addStep(step) {
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
   *
   * @param {*} step
   * @return {Step}
   */
  getLastStep(step) {
    return this.lastStep;
  }

  /**
   *
   * @param {string} commitFrom
   * @param {string} commitTo
   */
  setCommit(commitFrom, commitTo) {
    this.commitFrom = commitFrom;
    this.commitTo = commitTo;
    this.id = `${commitFrom}__${commitTo}`;
  }

  /**
   *
   * @param {string} branch
   */
  setBranch(branch) {
    this.branch = branch;
  }

  /**
   *
   * @param {*} message
   */
  setMessage(message) {
    this.message = message;
  }

  /**
   *`
   */
  setAllowPush() {
    this.allowPush = true;
    this.blocked = false;
  }

  /**
   *`
   */
  setAutoApproval() {
    this.autoApproved = true;
  }

  /**
   *`
   */
  setAutoRejection() {
    this.autoRejected = true;
  }
  /**
   * @return {bool}
   */
  continue() {
    return !(this.error || this.blocked);
  }
}

exports.Action = Action;
