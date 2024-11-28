const { Step } = require('../../actions');
const config = require('../../../config');
const commitConfig = config.getCommitConfig();
const authorizedlist = config.getAuthorisedList();

const fs = require('fs');

// Patterns for detecting different types of AI/ML assets
const FILE_PATTERNS = {
    modelWeights: /\.(h5|pb|pt|ckpt|pkl)$/, 
    // Regex for model weight files like .h5, .pt, .ckpt, or .pkl
    largeDatasets: /\.(csv|json|xlsx)$/, 
    // Regex for large dataset files
    aiLibraries: /(?:import\s+(tensorflow|torch|keras|sklearn|tokenizer)|require\(['"]tensorflow|torch|keras|sklearn|tokenizer['"]\))/, 
    // Regex for AI/ML libraries and tokenizers
    configKeys: /\b(epochs|learning_rate|batch_size|token)\b/, 
    // Regex for config keys in JSON/YAML including token-related keys
    aiFunctionNames: /\b(train_model|predict|evaluate|fit|transform|tokenize|tokenizer)\b/ 
    // Regex for AI/ML function/class names with token/tokenizer
};


// Function to check if a file name suggests it is AI/ML related (model weights or dataset)
const isAiMlFileByExtension = (fileName) => {
    const checkAiMlConfig = commitConfig.diff.block.aiMlUsage;
    // check file extensions for common model weight files
    if(checkAiMlConfig.blockPatterns.includes('modelWeights') 
        && FILE_PATTERNS.modelWeights.test(fileName)){ 
        // console.log("FOUND MODEL WEIGHTS");  
        return true; }
    // check file extensions for large datasets
    if(checkAiMlConfig.blockPatterns.includes('largeDatasets') 
        && FILE_PATTERNS.largeDatasets.test(fileName)){ 
            // console.log("FOUND LARGE DATASETS");
            return true; }
    return false;
};

// Function to check if file content suggests it is AI/ML related
const isAiMlFileByContent = (fileContent) => {
    const checkAiMlConfig = commitConfig.diff.block.aiMlUsage;
    // check file content for AI/ML libraries
    if(checkAiMlConfig.blockPatterns.includes('aiLibraries') 
        && FILE_PATTERNS.aiLibraries.test(fileContent)){
            // console.log("FOUND AI LIBRARIES");
            return true; }
    // check file content for config keys
    if(checkAiMlConfig.blockPatterns.includes('configKeys') 
        && FILE_PATTERNS.configKeys.test(fileContent)){ 
            // console.log("FOUND CONFIG KEYS");
            return true; }
    // check file content for AI/ML function/class names
    if(checkAiMlConfig.blockPatterns.includes('aiFunctionNames') 
        && FILE_PATTERNS.aiFunctionNames.test(fileContent)){ 
            // console.log("FOUND AI FUNCTION NAMES");
            return true; }
    return false;
};


// Main function to detect AI/ML usage in an array of file paths
const detectAiMlUsageFiles = async (filePaths,repoRoot) => {
    const results = [];
    // console.log("filePaths!", filePaths);    
    for (let filePath of filePaths) {
        try {
            const fileName = filePath.split('/').pop();
            // console.log(fileName, "!!!");
            // Check if the file name itself indicates AI/ML usage
            if (isAiMlFileByExtension(fileName)) {
                console.log("FOUND EXTENSION for ", fileName);
                results.push(false); continue; 
                // Skip content check if the file name is a match
            }
            // Check for AI/ML indicators within the file content
            // console.log("testing content for ", fileName);
            filePath = path.join(repoRoot, filePath);

            const content = await fs.promises.readFile(filePath, 'utf8');
            if (isAiMlFileByContent(content)) {
                results.push(false); continue;
            }
            results.push(true); // No indicators found in content
        } catch (err) {
            console.error(`Error reading file ${filePath}:`, err);
            results.push(false); // Treat errors as no AI/ML usage found
        }
    }

    return results;
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
    // console.log("HEYYY");
    const diffStep = action.steps.find((s) => s.stepName === 'diff');
    const step = new Step('checkForAiMlUsage');
    action.addStep(step);
    if(!commitConfig.diff.block.aiMlUsage.enabled) {
        // console.log("INSIDW!!")
        return action;
    }

    if (diffStep && diffStep.content) {
        const filePaths = extractFilePathsFromDiff(diffStep.content);
        // console.log(filePaths);

        if (filePaths.length) {
            const repoRoot = authorizedlist.find((item) => item.url === action.url).LocalRepoRoot;

            const aiMlDetected = await detectAiMlUsageFiles(filePaths,repoRoot);
            // console.log(aiMlDetected);
            const isBlocked = aiMlDetected.some(found => !found);
            // const isBlocked = false;

            if (isBlocked) {
                step.blocked = true;
                step.error = true;
                step.errorMessage = 'Your push has been blocked due to AI/ML usage detection';
                log(step.errorMessage);
            }
        } else {
            log('No valid image files found in the diff content.');
        }
    } else {
        log('No diff content available.');
    }

    return action;
};

exec.displayName = 'checkForAiMlUsage.exec';
module.exports = { exec };