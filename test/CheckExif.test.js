const { exec } = require('../src/proxy/processors/push-action/checkExifJpeg.js');
const sinon = require('sinon');
const { Action } = require('../src/proxy/actions/Action.js');
const { Step } = require('../src/proxy/actions/Step.js');


describe('Check EXIF Data From Images', () => {
    let logStub;
    

    beforeEach(() => {
        // Stub console.log and config.getCommitConfig for isolation in each test case
        logStub = sinon.stub(console, 'log');
       
    });

    afterEach(() => {
        // Restore stubs to avoid cross-test interference
        logStub.restore();
        // configStub.restore();
    });

    const createDiffContent = (filePaths) => {
        // Creates diff-like content for each file path to simulate actual git diff output
        return filePaths.map(filePath => `diff --git a/${filePath} b/${filePath}`).join('\n');
    };

    it('Should block push when sensitive EXIF metadata is found (GPS)', async () => {
       
        
        // Create action and step instances with test data that should trigger blocking
        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');

        // Set content with sensitive EXIF metadata in the test image file
        step.setContent(createDiffContent(['test/test_data/jpg/Sensitive_EXIF.jpg']));
        action.addStep(step);

        await exec(null, action);

        // Check that console.log was called with the blocking message
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive EXIF metadata detection in an image/));
    });

    it('Should block push when sensitive EXIF metadata is found (Camera Info)', async () => {
        

        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');

        // Set content for a file that contains Camera-Info EXIF data
        step.setContent(createDiffContent(['test/test_data/jpg/Sensitive_Data_EXIF_2.jpg']));
        action.addStep(step);

        await exec(null, action);

        // Assert blocking message was logged
        sinon.assert.calledWith(logStub, sinon.match(/Your push has been blocked due to sensitive EXIF metadata detection in an image/));
    });

    it('Should allow push when no sensitive EXIF metadata is found', async () => {
        // Configure with no sensitive EXIF parameters
        

        const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
        const step = new Step('diff');

        // Set content for a non-sensitive EXIF file
        step.setContent(createDiffContent(['test/test_data/jpg/Not_Sensitive_EXIF.jpg']));
        action.addStep(step);

        await exec(null, action);

        // Ensure no blocking message was logged
        sinon.assert.neverCalledWith(logStub, sinon.match(/Your push has been blocked due to sensitive EXIF metadata detection in an image/));
    });

    
});
