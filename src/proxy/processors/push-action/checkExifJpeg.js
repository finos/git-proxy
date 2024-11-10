// const fs = require('fs');
const { ExifTool } = require('exiftool-vendored');
// const path = require('path');
const Step = require('../../actions').Step;
// const { exec: getDiffExec } = require('./getDiff');

// List of valid extensions
const validExtensions = ['.jpeg', '.jpeg', '.jpg', '.tiff']

//check for sensitive image embedded metadata
const checkSensitiveExifData = (metadata) => {
    // Check for GPS latitude and longitude in the EXIF data
    if (metadata.GPSLatitude || metadata.GPSLongitude) {
        // Return false if sensitive GPS data is detected
        return false;
    }

    // Additional checks can be added here as needed
    // Example: Check for specific timestamps, author information, etc.
    // if (metadata.Make || metadata.Model || metadata.Software) {
    //     console.warn("Sensitive metadata found in image");
    //     return false;
    // }

    // Return true if no sensitive data is found
    return true;
};

// Function to parse the file based on its extension
const getExifData = async (filePath) => {
    const exifTool = new ExifTool();
    try {
        // Read EXIF data using ExifTool
        const metadata = await exifTool.read(filePath);
        // Check if EXIF data exists
        if (metadata) {
            // console.log(`EXIF data for ${filePath}:`, metadata);
            return checkSensitiveExifData(metadata);
        } else {
            // console.log(`No EXIF data found for ${filePath}`);
            return true;
        }
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

        // Use the parsing function to get file paths
        const filePaths = extractFilePathsFromDiff(diffStep.content);
        // console.log("FILE PATHS!! ", filePaths, "FILE PATHS ENDS");
        const filteredPaths = filePaths.filter(path => validExtensions.some(x => path.endsWith(x)) );
        // console.log("FILTER PATHS!! ", filteredPaths, "FILTER PATHS ENDS");

        if (filteredPaths.length > 0) {
            // Check for sensitive data in all files
            const sensitiveDataFound = await Promise.all(filteredPaths.map(getExifData));
            // const anySensitiveDataDetected = sensitiveDataFound.some(found => found);
            const ExifDataBlock = sensitiveDataFound.some(found => !found);

            if (ExifDataBlock) {
                step.blocked= true;
                step.error = true;
                step.errorMessage = 'Your push has been blocked due to sensitive EXIF metadata detection in an image';
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