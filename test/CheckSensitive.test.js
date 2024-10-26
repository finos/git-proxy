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
        const action = {
            steps: [{
                stepName: 'diff',
                content: {
                    filePaths: [path.join(__dirname, 'test_data/sensitive_data.csv')] // Ensure this path is correct
                }
            }]
        };

        await exec(null, action);

        const loggedMessages = logStub.getCalls().map(call => call.args[0]);
        console.log('Captured log messages for CSV:', loggedMessages);

        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in XLSX file and block execution', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: {
                    filePaths: [path.join(__dirname, 'test_data/sensitive_data2.xlsx')] // Ensure this path is correct
                }
            }]
        };

        await exec(null, action);

        const loggedMessages = logStub.getCalls().map(call => call.args[0]);
        console.log('Captured log messages for XLSX:', loggedMessages);

        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in a log file and block execution', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: {
                    filePaths: [path.join(__dirname, 'test_data/sensitive_data3.log')] // Ensure this path is correct
                }
            }]
        };

        await exec(null, action);

        const loggedMessages = logStub.getCalls().map(call => call.args[0]);
        console.log('Captured log messages for log file:', loggedMessages);

        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in a JSON file and block execution', async () => {
        const action = {
            steps: [{
                stepName: 'diff',
                content: {
                    filePaths: [path.join(__dirname, 'test_data/sensitive_data4.json')] // Ensure this path is correct
                }
            }]
        };

        await exec(null, action);

        const loggedMessages = logStub.getCalls().map(call => call.args[0]);
        console.log('Captured log messages for JSON file:', loggedMessages);

        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    
});
