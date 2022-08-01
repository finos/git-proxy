/** Class representing a Push. */
const config = require('../../config');

/**
 *
 * @param {string} str1
 * @param {string} str2
 * @param {boolean} ignore
 * @return {string}
 */
// eslint-disable-next-line no-extend-native
String.prototype.replaceAll = function(str1, str2, ignore) {
  return this.replace(
      new RegExp(str1.replace(
          /([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, '\\$&'),
      (ignore?'gi':'g')),
          (typeof(str2)=='string') ? str2.replace(/\$/g, '$$$$'):str2);
};

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
  commitFrom;
  commitTo;
  branch;
  message;
  author;
  user;

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
   *
   * @param {*} branch
   */
  setBranch(branch) {
    this.branch = branch;
  }

  /**
   *
   * @param {*} branch
   */
  setAuthor(branch) {
    this.author = author;
  }

  /**
   *
   * @param {*} branch
   */
  setUser(branch) {
    this.user = user;
  }

  /**
   *`
   */
  setAllowPush() {
    this.allowPush = true;
    this.blocked = false;
  }

  /**
   * @return {bool}
   */
  continue() {
    const cont = !(this.error || this.blocked);
    return cont;
  }
}

exports.Action = Action;
