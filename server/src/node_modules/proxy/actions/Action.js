/** Class representing a Push. */
class Action {
  steps = [];
  lastStep;
  error = false;
  errorMessage;
  blocked = false;
  blockedMessage;
  allowPush = false;
  commitFrom;
  commitTo;
  branch;
    
  /**
   * Create a Push Action
   */
  constructor(id, type, method, timestamp, repo) {
    this.id = id;
    this.type = type;
    this.method = method;    
    this.timestamp = timestamp;
    this.project = repo.split('/')[0]
    this.repoName = repo.split('/')[1]    
    this.url = `https://github.com/${repo}`;
    this.repo = repo;
  }

  addStep(step) {
    this.steps.push(step)
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

  getLastStep(step) {
    return this.lastStep;
  }

  setCommit(commitFrom, commitTo) {
    this.commitFrom = commitFrom;
    this.commitTo = commitTo;
    this.id = `${commitFrom}__${commitTo}`;
  }

  setBranch(branch) {
    this.branch = branch;
  }

  setAllowPush() {
    console.log("STEP SETTING ALLOW PUSH")
    this.allowPush = true;
    this.blocked = false;
  }

  continue() {
    const cont = !(this.error || this.blocked);
    console.log(`continue step error=${this.error}  blocked=${this.blocked} cont=${cont}`)
    return cont;
  }
}

exports.Action = Action;
