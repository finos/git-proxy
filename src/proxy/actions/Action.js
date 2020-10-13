/** Class representing a Push. */
String.prototype.replaceAll = function(str1, str2, ignore) 
{
    return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
} 

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
    //const branch = this.branch.replaceAll(' ', '')
    this.id = `${commitFrom}__${commitTo}`;
  }

  setBranch(branch) {
    this.branch = branch;
  }

  setMessage(message) {
    this.message = message;
  }

  setBranch(branch) {
    this.branch = branch;
  }

  setAuthor(branch) {
    this.author = author;
  }

  setUser(branch) {
    this.user = user;
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
