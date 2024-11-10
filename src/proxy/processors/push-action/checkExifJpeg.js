// const fs = require('fs');
const { ExifTool } = require('exiftool-vendored');
// const path = require('path');
const Step = require('../../actions').Step;
// const { exec: getDiffExec } = require('./getDiff');

// List of valid extensions
const validExtensions = ['.jpeg', '.jpeg', '.jpg', '.tiff']


// // Function to parse the file based on its extension
const getExifData = async (filePath) => {
    const exifTool = new ExifTool();
    try {
        // Read EXIF data using ExifTool
        const metadata = await exifTool.read(filePath);
        // Check if EXIF data exists
        if (metadata) {
            console.log(`EXIF data for ${filePath}:`, metadata);
        } else {
            console.log(`No EXIF data found for ${filePath}`);
        }
        // Simulate random sensitive data detection
        return Math.random() < 0.5; // Random true/false
    } catch (error) {
        console.error(`Error reading EXIF data from ${filePath}:`, error);
        return false; // Return false if error occurs
    } finally {
        // Close exiftool process
        await exifTool.end();
    }
};
// Async exec function to handle actions
// Function to parse file paths from git diff content
const extractFilePathsFromDiff = (diffContent) => {
    const filePaths = [];
    const lines = diffContent.split('\n');
    
    lines.forEach(line => {
        const match = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
        if (match) {
            filePaths.push(match[1]); // Extract the file path from "a/" in the diff line
        }
    });
    
    return filePaths;
};

const exec = async (req, action) => {
    const diffStep = action.steps.find((s) => s.stepName === 'diff');
    const step = new Step('checkExifDataFromImage');

    if (diffStep && diffStep.content) {
        // console.log('Diff content! ', diffStep.content, "DIFF CONTENT END");

        // Use the parsing function to get file paths
        const filePaths = extractFilePathsFromDiff(diffStep.content);
        // console.log("FILE PATHS!! ", filePaths, "FILE PATHS ENDS");
        const filteredPaths = filePaths.filter(path => validExtensions.some(x => path.endsWith(x)) );
        // console.log("FILTER PATHS!! ", filteredPaths, "FILTER PATHS ENDS");

        if (filteredPaths.length > 0) {
            // Check for sensitive data in all files
            const sensitiveDataFound = await Promise.all(filePaths.map(getExifData));
            // const anySensitiveDataDetected = sensitiveDataFound.some(found => found);
            const ExifDataBlock = !sensitiveDataFound;

            if (ExifDataBlock) {
                step.blocked= true;
                step.error = true;
                step.errorMessage = 'Your push has been blocked due to sensitive data detection.';
                console.log(step.errorMessage);
            }
        } else {
            console.log('No file paths provided in the diff step.');
        }
    } else {
        console.log('No diff content available.');
    }
    action.addStep(step);
    return action; // Returning action for testing purposes
};



exec.displayName = 'logFileChanges.exec';
exports.exec = exec;