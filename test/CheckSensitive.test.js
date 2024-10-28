// const path = require('path');
const { exec } = require('../src/proxy/processors/push-action/checkSensitiveData.js'); // Adjust path as necessary
const sinon = require('sinon');

describe('Sensitive Data Detection', () => {
    let logStub;

    beforeEach(() => {
        logStub = sinon.stub(console, 'log'); // Stub console.log before each test
    });

    afterEach(() => {
        logStub.restore(); // Restore console.log after each test
    });

    const createDiffContent = (filePaths) => {
        // Format file paths in diff format
        return filePaths.map(filePath => `diff --git a/${filePath} b/${filePath}`).join('\n');
    };

    it('should detect sensitive data in CSV file and block execution', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: createDiffContent(['test/test_data/sensitive_data.csv']) // Ensure this path is correct
            }]
        };
        await exec(null, action);
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in XLSX file and block execution', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: createDiffContent(['test/test_data/sensitive_data2.xlsx']) // Ensure this path is correct
            }]
        };
        await exec(null, action);
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in a log file and block execution', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: createDiffContent(['test/test_data/sensitive_data3.log']) // Ensure this path is correct
            }]
        };
        await exec(null, action);
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in a JSON file and block execution', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: createDiffContent(['test/test_data/sensitive_data4.json']) // Ensure this path is correct
            }]
        };
        await exec(null, action);
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should allow execution if no sensitive data is found', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: createDiffContent(['test_data/no_sensitive_data.txt']) // Ensure this path is correct
            }]
        };
        await exec(null, action);
        sinon.assert.neverCalledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should allow execution for an empty file', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: createDiffContent(['test_data/empty_file.txt']) // Ensure this path is correct
            }]
        };
        await exec(null, action);
        sinon.assert.neverCalledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should handle file-not-found scenario gracefully', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: createDiffContent(['test_data/non_existent_file.txt']) // Ensure this path is correct
            }]
        };
        try {
            await exec(null, action);
        } catch (error) {
            sinon.assert.match(error.message, /ENOENT: no such file or directory/);
        }
    });
});
