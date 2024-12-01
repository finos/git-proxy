const { Step } = require('../../actions');
const { exec: cexec } = require('child_process');

const path = require('path');
const config = require('../../../config');
const commitConfig = config.getCommitConfig();
const authorizedlist = config.getAuthorisedList();


// Function to extract relevant file paths from Git diff content
// go to proxyconfig.json and enable the feature
// gitleaks.report.json will show the secrets found and in which file they are found
// Function to extract relevant file paths and their parent directories

// gitleaks dir "C:/Users/ingle/Desktop/CitiHackthon/git-proxy/test/test_data/sensitive_data.js" --config="c:/Users/ingle/Desktop/CitiHackthon/git-proxy/gitleaks.toml" --report-format json --log-level debug --report-path="c:/Users/ingle/Desktop/CitiHackthon/git-proxy/gitleaks_report.json"
// use the command to run gitleaks from terminal
// Function to extract relevant directories from Git diff content
function extractRelevantDirectories(diffContent) {
  const relevantDirectories = [];
  const relevantExtensions = ['.json', '.yaml', '.yml', '.js', '.ts', '.txt'];
  const lines = diffContent.split('\n');

  lines.forEach((line) => {
    const match = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
    if (match) {
      const filePath = match[1];
      const fileExtension = `.${filePath.split('.').pop()}`;

      if (relevantExtensions.includes(fileExtension)) {
        const dirPath = path.dirname(filePath);
        if (!relevantDirectories.includes(dirPath)) {
          relevantDirectories.push(dirPath);
        }
      }
    }
  });

  return relevantDirectories;
}

// Function to run Gitleaks with directory paths
function runGitleaks(filePaths,repoRoot) {
  return new Promise((resolve, reject) => {
    const filesToCheck = filePaths
      .map((filePath) => `"${path.resolve(repoRoot,filePath).replace(/\\/g, '/')}"`)
      .join(' ');
    console.log("filesToCheck:", filesToCheck);

    const configPath = path.resolve(__dirname, '../../../../gitleaks.toml').replace(/\\/g, '/');
    const reportPath = repoRoot + '/gitleaks_report.json';

    const command = `gitleaks dir ${filesToCheck}  --config="${configPath}" --report-format json --log-level debug --report-path="${reportPath}"`;
    console.log(`Executing Gitleaks Command: ${command}`);

    cexec(command, (error, stdout, stderr) => {
      if (error) {
        // If leaks are found, handle the warning gracefully
        console.log("stderrrrr:",stderr);
        if (stderr.includes("leaks found")) {
          console.warn("Leaks were found, but execution succeeded.");
          resolve(true); // Consider this a successful run
        } else {
          console.error(`Error executing gitleaks: ${error.message}`);
          reject(new Error(`Error executing gitleaks: ${error.message}`));
        }
      } else {
        resolve(false);
      }
    });
  });
}




// Example usage in exec function
const exec = async (req, action) => {
  const diffStep = action.steps.find((s) => s.stepName === 'diff');
  const step = new Step('checkforSecrets');
  const commitinfo = commitConfig.checkForSecrets;

  if (!commitinfo.enabled) {
    action.addStep(step);
    return action;
  }

  if (diffStep && diffStep.content) {
    const dirPaths = extractRelevantDirectories(diffStep.content);
    const repoRoot = authorizedlist.find((item) => item.url === action.url).LocalRepoRoot;
    
    if (dirPaths.length > 0) {
      try {
        const res = await runGitleaks(dirPaths,repoRoot);
        

        if (res) {
          step.blocked = true;
          step.blockedMessage = 'Sensitive secrets detected in the diff.';
          console.log('Sensitive secrets detected! Push blocked.');
        } else {
          console.log('No sensitive secrets detected.');
        }
        action.addStep(step);
      } catch (err) {
        console.error('Error during Gitleaks execution:', err);
      }
    } else {
      console.log('No relevant directories found in the diff.');
    }
  } else {
    console.log('No diff content available.');
  }

  return action;
};

exec.displayName = 'checkforSecrets.exec';
module.exports = { exec };



