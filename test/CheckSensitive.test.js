// const path = require('path');
const { exec } = require('../src/proxy/processors/push-action/checkSensitiveData.js'); // Adjust path as necessary
const sinon = require('sinon');
const {Action}=require('../src/proxy/actions/Action.js')
const {Step}=require('../src/proxy/actions/Step.js')

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
        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');

        // Create diff content simulating sensitive data in CSV
        step.setContent(createDiffContent(['test/test_data/sensitive_data.csv']));
        action.addStep(step)
     
        await exec(null, action);
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in XLSX file and block execution', async () => {
        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');
        step.setContent(createDiffContent(['test/test_data/sensitive_data2.xlsx']));
        action.addStep(step);
       
        await exec(null, action);
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in a log file and block execution', async () => {
      
        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');
        step.setContent(createDiffContent(['test/test_data/sensitive_data3.log']));
        action.addStep(step);
        await exec(null, action);
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should detect sensitive data in a JSON file and block execution', async () => {
       
       
        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');
        step.setContent(createDiffContent(['test/test_data/sensitive_data4.json']));
        action.addStep(step);
        await exec(null, action);
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should allow execution if no sensitive data is found', async () => {
       
      
        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');
        step.setContent(createDiffContent(['test_data/no_sensitive_data.txt']));
        action.addStep(step);
        await exec(null, action);
        sinon.assert.neverCalledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should allow execution for an empty file', async () => {
       
      
        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');
        step.setContent(createDiffContent(['test_data/empty_file.txt']));
        action.addStep(step);
        await exec(null, action);
        sinon.assert.neverCalledWith(logStub, sinon.match(/Your push has been blocked due to sensitive data detection/));
    });

    it('should handle file-not-found scenario gracefully', async () => {
        
        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');
        step.setContent(createDiffContent(['test_data/non_existent_file.txt']));
        action.addStep(step);
        try {
            await exec(null, action);
        } catch (error) {
            sinon.assert.match(error.message, /ENOENT: no such file or directory/);
        }
    });
});
