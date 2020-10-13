const { v4: uuidv4 } = require('uuid');

/** Class representing a Push. */
class Step {

  logs = [];
    
  constructor(stepName, error=false, errorMessage=null, blocked=false, blockedMessage=null, content=null) {
    this.id = uuidv4();
    this.stepName = stepName;
    this.content = content;
    
    this.error = error;
    this.errorMessage = errorMessage;    
    
    this.blocked = blocked;
    this.blockedMessage = blockedMessage;
  }

  setError(message) {
    this.error = true;
    this.errorMessage = message;
    this.log(message);
  }

  setContent(content) {
    this.log('setting content');
    this.content = content;
  }

  setAsyncBlock(message) {
    this.log('setting blocked');
    this.blocked = true;
    this.blockedMessage = message;
  }

  log(message) {
    const m = `${this.stepName} - ${message}`
    this.logs.push(m);
    console.info(m);
  }
}

exports.Step = Step;
