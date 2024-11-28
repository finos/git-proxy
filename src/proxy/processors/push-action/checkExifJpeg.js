const { ExifTool } = require('exiftool-vendored');
const { Step } = require('../../actions');
const config = require('../../../config');

const commitConfig = config.getCommitConfig();
const authorizedlist = config.getAuthorisedList();

const validExtensions = ['.jpeg', '.png', '.jpg', '.tiff'];
// Make sure you have modified the proxy.config.json;
// Function to check sensitive EXIF data
const checkSensitiveExifData = (metadata) => {
    let allSafe = true;



        if (metadata.GPSLatitude || metadata.GPSLongitude) {
            console.log('GPS data detected; push is blocked due to sensitive EXIF metadata');
            allSafe = false;
        }

    
        if (metadata.Make || metadata.Model || metadata.Software) {
            console.log('Camera information detected; push is blocked due to sensitive EXIF metadata');
            allSafe = false;
        }
    

    return allSafe;
};

// Function to retrieve EXIF data using ExifTool
const getExifData = async (relativePath,repoRoot) => {
    const exifTool = new ExifTool();
    const filePath = path.join(repoRoot, relativePath);
    try {
        const metadata = await exifTool.read(filePath);
        return metadata ? checkSensitiveExifData(metadata) : true;
    } catch (error) {
        console.log(`Error reading EXIF data from ${filePath}: ${error.message}`);
        return false;
    } finally {
        await exifTool.end();
    }
};

// Helper function to parse file paths from git diff content
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

// Main exec function
const exec = async (req, action, log = console.log) => {

    const diffStep = action.steps.find((s) => s.stepName === 'diff');
    const step = new Step('checkExifJpeg');
    const allowedFileType = commitConfig.diff.block.ProxyFileTypes;

    if (diffStep && diffStep.content) {
        const filePaths = extractFilePathsFromDiff(diffStep.content);
        const filteredPaths = filePaths.filter(path => validExtensions.some(ext => path.endsWith(ext) && allowedFileType.includes(ext)));

        if (filteredPaths.length > 0) {
            
            const exifResults = await Promise.all(
                filteredPaths.map((Path) => {
                  const repo = action.url;
                  const repoRoot = authorizedlist.find((item) => item.url === repo).LocalRepoRoot;
                  getExifData(Path, repoRoot);
                }),
              );
            const isBlocked = exifResults.some(result => !result);

            if (isBlocked) {
                step.blocked = true;
                step.error = true;
                step.errorMessage = 'Your push has been blocked due to sensitive EXIF metadata detection in an image';
                log(step.errorMessage);
            }
        } else {
            log('No valid image files found in the diff content.');
        }
    } else {
        log('No diff content available.');
    }

    action.addStep(step);
    return action;
};

exec.displayName = 'CheckExif.exec';
module.exports = { exec };
