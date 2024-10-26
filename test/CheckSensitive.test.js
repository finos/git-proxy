const path = require('path');
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

    it('should detect sensitive data in CSV file and block execution', async () => {
        // Set up the action with the correct file path
        const action = {
            steps: [{
                stepName: 'diff',
                content: {
                    filePaths: [path.join(__dirname, 'test_data/sensitive_data.csv')] // Ensure this path is correct
                }
            }]
        };

        // Call exec with necessary parameters
        await exec(null, action); // Ensure exec is awaited if it's a promise

        // Capture logged messages for debugging after exec execution
        const loggedMessages = logStub.getCalls().map(call => call.args[0]);
        console.log('Captured log messages for CSV:', loggedMessages);

        // Check if the blocking message is logged
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in XLSX file and block execution', async () => {
        // Set up the action with the correct file path for XLSX
        const action = {
            steps: [{
                stepName: 'diff',
                content: {
                    filePaths: [path.join(__dirname, 'test_data/sensitive_data2.xlsx')] // Ensure this path is correct
                }
            }]
        };

        // Call exec with necessary parameters
        await exec(null, action); // Ensure exec is awaited if it's a promise

        // Capture logged messages for debugging after exec execution
        const loggedMessages = logStub.getCalls().map(call => call.args[0]);
        console.log('Captured log messages for XLSX:', loggedMessages);

        // Check if the blocking message is logged
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });
});
