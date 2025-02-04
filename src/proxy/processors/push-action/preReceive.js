const fs = require('fs');
const path = require('path');
const Step = require('../../actions').Step;
const { spawnSync } = require('child_process');

const sanitizeInput = (req, action) => {
  return `${action.oldCommit} ${action.newCommit} ${action.ref}\n`;
};

const exec = async (req, action, hookFilePath = './hooks/pre-receive.sh') => {
  const step = new Step('executeExternalPreReceiveHook');

  try {
    const resolvedPath = path.resolve(hookFilePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Hook file not found: ${resolvedPath}`);
    }

    console.log(`Executing pre-receive hook from: ${resolvedPath}`);

    const sanitizedInput = sanitizeInput(req, action);

    const hookProcess = spawnSync(resolvedPath, [], {
      input: JSON.stringify(sanitizedInput),
      encoding: 'utf-8',
    });

    const { stdout, stderr, status } = hookProcess;

    if (status !== 0) {
      console.error(`Pre-receive hook failed with exit code ${status}`);
      step.error = true;
      step.log(`Hook stderr: ${stderr.trim()}`);
      step.setError(stdout.trim());
      action.addStep(step);
      return action;
    }

    console.log('Pre-receive hook executed successfully');
    console.log(`Hook stdout: ${stdout.trim()}`);
    step.log('Pre-receive hook executed successfully');
    action.addStep(step);
    return action;
  } catch (error) {
    console.error('Error during pre-receive hook execution:', error);
    step.error = true;
    step.setError(`Hook execution error: ${error.message}`);
    action.addStep(step);
    return action;
  }
};

exec.displayName = 'executeExternalPreReceiveHook.exec';
exports.exec = exec;
