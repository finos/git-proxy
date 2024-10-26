const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const path = require('path');
const { exec: getDiffExec } = require('./getDiff');

// Function to check for sensitive data patterns
const checkForSensitiveData = (cell) => {
    const sensitivePatterns = [
        /\d{3}-\d{2}-\d{4}/, // Social Security Number (SSN)
        /\b\d{16}\b/, // Credit card numbers
        /\b\d{5}-\d{4}\b/, // ZIP+4 codes
        // Add more patterns as needed
    ];
    return sensitivePatterns.some(pattern => {
        if (pattern.test(String(cell))) {
            console.log(`\x1b[31mDetected sensitive data: ${cell}\x1b[0m`); // Log the detected sensitive data in red
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
                for (const [key, value] of Object.entries(row)) {
                    if (checkForSensitiveData(value)) {
                        console.log(`\x1b[33mSensitive data found in CSV: ${key}: ${value}\x1b[0m`); // Log in yellow
                        sensitiveDataFound = true;
                    }
                }
            })
            .on('end', () => {
                if (!sensitiveDataFound) {
                    console.log('No sensitive data found in CSV.');
                }
                resolve(sensitiveDataFound); // Resolve with the flag indicating if sensitive data was found
            })
            .on('error', (err) => {
                console.error(`Error reading CSV file: ${err.message}`);
                reject(err); // Reject the promise on error
            });
    });
};

// Function to process XLSX files
const processXLSX = async (filePath) => {
    return new Promise((resolve, reject) => {
        let sensitiveDataFound = false;

        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            jsonData.forEach((row) => {
                for (const [key, value] of Object.entries(row)) {
                    if (checkForSensitiveData(value)) {
                        console.log(`\x1b[33mSensitive data found in XLSX: ${key}: ${value}\x1b[0m`); // Log in yellow
                        sensitiveDataFound = true;
                    }
                }
            });

            if (!sensitiveDataFound) {
                console.log('No sensitive data found in XLSX.');
            }
            resolve(sensitiveDataFound); // Resolve with the flag indicating if sensitive data was found
        } catch (error) {
            console.error(`Error reading XLSX file: ${error.message}`);
            reject(error); // Reject the promise on error
        }
    });
};

// Function to check for sensitive data in .log and .json files
const checkLogJsonFiles = async (filePath) => {
    return new Promise((resolve, reject) => {
        let sensitiveDataFound = false;

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file ${filePath}: ${err.message}`);
                return reject(err);
            }

            if (checkForSensitiveData(data)) {
                console.log(`\x1b[33mSensitive data found in ${filePath}\x1b[0m`);
                sensitiveDataFound = true;
            }

            resolve(sensitiveDataFound);
        });
    });
};

// Function to parse the file based on its extension
const parseFile = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
        case '.csv':
            return await processCSV(filePath);
        case '.xlsx':
            return await processXLSX(filePath);
        case '.log':
            return await checkLogJsonFiles(filePath);
        case '.json':
            return await checkLogJsonFiles(filePath);
        default:
            // Skip unsupported file types without logging
            return false; // Indicate that no sensitive data was found for unsupported types
    }
};

// Async exec function to handle actions
const exec = async (req, action) => {
    // getDiffExec(req, action); // Call to getDiffExec if necessary

    const diffStep = action.steps.find((s) => s.stepName === 'diff');

    if (diffStep && diffStep.content) {
        console.log('Diff content:', diffStep.content);

        const filePaths = diffStep.content.filePaths || [];

        if (filePaths.length > 0) {
            // Check for sensitive data in all files
            const sensitiveDataFound = await Promise.all(filePaths.map(parseFile));
            const anySensitiveDataDetected = sensitiveDataFound.some(found => found); // Check if any file reported sensitive data

            if (anySensitiveDataDetected) {
                action.pushBlocked = true; // Block the push
                action.error = true; // Set error flag
                action.errorMessage = 'Your push has been blocked due to sensitive data detection.'; // Set error message
                console.log(action.errorMessage);
            }
        } else {
            console.log('No file paths provided in the diff step.');
        }
    } else {
        console.log('No diff content available.');
    }

    return action; // Returning action for testing purposes
};

exec.displayName = 'logFileChanges.exec';
exports.exec = exec;
