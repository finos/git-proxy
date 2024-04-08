const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../logging/index');

/** Class representing a Push. */
class Step {
  logs = [];

  /**
   *
   * @param {*} stepName
   * @param {*} error
   * @param {*} errorMessage
   * @param {*} blocked
   * @param {*} blockedMessage
   * @param {*} content
   */
  constructor(
    stepName,
    error = false,
    errorMessage = null,
    blocked = false,
    blockedMessage = null,
    content = null,
  ) {
    this.id = uuidv4();
    this.stepName = stepName;
    this.content = content;

    this.error = error;
    this.errorMessage = errorMessage;

    this.blocked = blocked;
    this.blockedMessage = blockedMessage;
  }

  /**
   *
   * @param {*} message
   */
  setError(message) {
    this.error = true;
    this.errorMessage = message;
    this.log(message, true);
  }

  /**
   *
   * @param {*} content
   */
  setContent(content) {
    this.log('setting content');
    this.content = content;
  }

  /**
   *
   * @param {*} message
   */
  setAsyncBlock(message) {
    this.log('setting blocked');
    this.blocked = true;
    this.blockedMessage = message;
  }

  /**
   *
   * @param {*} message
   * @param {boolean} isError
   */
  log(message, isError = false) {
    const m = `${this.stepName} - ${message}`;
    this.logs.push(m);

    if (isError) {
      logger.error(m);
    } else {
      logger.info(m);
    }
  }
}

exports.Step = Step;
