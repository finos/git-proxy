const execSync = require('child_process').execSync;
const Step = require('../../actions').Step;
const fs = require('fs');
const dir = './.remote';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const exec = async (req, action) => {
  const step = new Step('pullRemote');

  try {    
    action.proxyGitPath = `${dir}/${action.timestamp}`;

    step.log(`Creating folder ${action.proxyGitPath}`);

    if (!fs.existsSync(action.proxyGitPath)) {
      fs.mkdirSync(action.proxyGitPath, '0777', true);
    }
  
    const cmd = `git clone ${action.url} --bare`
    step.log(`Exectuting ${cmd}`);

    const response = execSync(`git clone ${action.url} --bare`, {cwd: action.proxyGitPath}).toString('utf-8')    

    step.log(`Completed ${cmd}`);
    step.setContent(response);
  }
  catch (e) {    
    step.setError(e.toString('utd-8'));
    throw e;
  } 
  finally {
    action.addStep(step)
    return action;
  }
};

exec.displayName = 'pullRemote.exec';
exports.exec = exec;
