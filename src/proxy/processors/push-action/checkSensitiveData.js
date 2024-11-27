const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const path = require('path');
const Step = require('../../actions').Step;
const config = require('../../../config');

const commitConfig = config.getCommitConfig();
const authorizedlist = config.getAuthorisedList();

// Function to check for sensitive data patterns
const checkForSensitiveData = (cell) => {
  const sensitivePatterns = [
    /\d{3}-\d{2}-\d{4}/, // Social Security Number (SSN)
    /\b\d{16}\b/, // Credit card numbers
    /\b\d{5}-\d{4}\b/, // ZIP+4 codes
  ];
  return sensitivePatterns.some((pattern) => {
    if (pattern.test(String(cell))) {
      console.log(`\x1b[31mDetected sensitive data: ${cell}\x1b[0m`); // Log in red
      return true;
    }
    return false;
  });
};

// Function to process CSV files
const processCSV = async (filePath) => {
  return new Promise((resolve, reject) => {
    let sensitiveDataFound = false;
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        for (const value of Object.values(row)) {
          if (checkForSensitiveData(value)) {
            sensitiveDataFound = true;
          }
        }
      })
      .on('end', () => resolve(sensitiveDataFound))
      .on('error', reject);
  });
};

// Function to process XLSX files
const processXLSX = async (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    return jsonData.some((row) => Object.values(row).some((value) => checkForSensitiveData(value)));
  } catch (error) {
    console.error(`Error reading XLSX file: ${error.message}`);
    throw error;
  }
};

// Function to check for sensitive data in log and JSON files
const checkLogJsonFiles = async (filePath) => {
  const data = await fs.promises.readFile(filePath, 'utf8');
  return checkForSensitiveData(data);
};

// Function to parse files based on extensions
const parseFile = async (repoRoot, relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  const ext = path.extname(filePath).toLowerCase();
  const FilestoCheck = commitConfig.diff.block.proxyFileTypes;

  if (!FilestoCheck.includes(ext)) {
    console.log(`${ext} is not included in CommitConfig for proxy checks!`);
    return false;
  }

  switch (ext) {
    case '.csv':
      return await processCSV(filePath);
    case '.xlsx':
      return await processXLSX(filePath);
    case '.log':
    case '.json':
      return await checkLogJsonFiles(filePath);
    default:
      return false;
  }
};

// Function to extract file paths from git diff
const extractFilePathsFromDiff = (diffContent) => {
  return diffContent
    .split('\n')
    .map((line) => {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
      return match ? match[1] : null;
    })
    .filter(Boolean);
};

// Main exec function
const exec = async (req, action) => {
  const diffStep = action.steps.find((s) => s.stepName === 'diff');
  const step = new Step('checksensitiveData');

  if (diffStep && diffStep.content) {
    console.log('Diff content:', diffStep.content);
    const filePaths = extractFilePathsFromDiff(diffStep.content);

    if (filePaths.length > 0) {
      try {
        const repoUrl = action.url;
        const repo = authorizedlist.find((item) => item.url === repoUrl);
        // console.log(repo);
        const repoRoot = repo.LocalRepoRoot;
        // console.log('my reporoot is ' + repoRoot);

        const sensitiveDataFound = await Promise.all(
          filePaths.map((filePath) => parseFile(repoRoot, filePath)),
        );
        const anySensitiveDataDetected = sensitiveDataFound.some((found) => found);

        if (anySensitiveDataDetected) {
          step.blocked = true;
          step.error = true;
          step.errorMessage = 'Your push has been blocked due to sensitive data detection.';
          console.log(step.errorMessage);
        }
      } catch (error) {
        console.error(`Error processing files: ${error.message}`);
      }
    } else {
      console.log('No file paths provided in the diff step.');
    }
  } else {
    console.log('No diff content available.');
  }
  console.log('This is my log \n');
  console.log(action.url);
  action.addStep(step);
  return action;
};

exec.displayName = 'logFileChanges.exec';
exports.exec = exec;
