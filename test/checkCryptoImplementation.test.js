const { expect } = require('chai');
const { analyzeCodeForCrypto, exec } = require('../src/proxy/processors/push-action/checkCryptoImplementation.js');

describe('Crypto Implementation Check Plugin', () => {
  describe('analyzeCodeForCrypto', () => {
    it('should detect non-standard encryption algorithms', () => {
      const testCode = `
        function customEncrypt(data) {
          return data.split('').map(char => 
            String.fromCharCode(char.charCodeAt(0) ^ 0x7F)
          ).join('');
        }
      `;
      
      const issues = analyzeCodeForCrypto(testCode);
      expect(issues).to.have.lengthOf.at.least(1);
      expect(issues.some(i => i.type === 'non_standard_algorithm')).to.be.true;
    });

    it('should detect suspicious bit operations', () => {
      const testCode = `
        function scrambleData(data) {
          let result = '';
          for(let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data.charCodeAt(i) >>> 2);
          }
          return result;
        }
      `;
      
      const issues = analyzeCodeForCrypto(testCode);
      expect(issues).to.have.lengthOf.at.least(1);
      expect(issues.some(i => i.type === 'suspicious_operation')).to.be.true;
    });

    it('should detect suspicious variable names', () => {
      const testCode = `
        const cipher = {};
        let salt = generateRandomBytes(16);
        const iv = new Uint8Array(12);
      `;
      
      const issues = analyzeCodeForCrypto(testCode);
      expect(issues).to.have.lengthOf.at.least(3);
      expect(issues.some(i => i.type === 'suspicious_variable')).to.be.true;
    });

    it('should not flag standard crypto library usage', () => {
      const testCode = `
        const crypto = require('crypto');
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      `;
      
      const issues = analyzeCodeForCrypto(testCode);
      expect(issues.filter(i => i.severity === 'high')).to.have.lengthOf(0);
    });

    it('should handle empty input', () => {
      const issues = analyzeCodeForCrypto('');
      expect(issues).to.be.an('array').that.is.empty;
    });

    it('should handle null or undefined input', () => {
      expect(analyzeCodeForCrypto(null)).to.be.an('array').that.is.empty;
      expect(analyzeCodeForCrypto(undefined)).to.be.an('array').that.is.empty;
    });

  });

  describe('exec', () => {

    it('should handle empty diff content', async () => {
      const req = {};
      const action = {
        commitData: [{
          hash: '123abc',
          diff: ''
        }],
        addStep: function(step) { this.step = step; }
      };

      const result = await exec(req, action);
      expect(result.step.error).to.be.false;
    });

    it('should handle undefined diff content', async () => {
      const req = {};
      const action = {
        commitData: [{
          hash: '123abc'
          // diff is undefined
        }],
        addStep: function(step) { this.step = step; }
      };

      const result = await exec(req, action);
      expect(result.step.error).to.be.false;
    });

    it('should handle empty commitData array', async () => {
      const req = {};
      const action = {
        commitData: [],
        addStep: function(step) { this.step = step; }
      };

      const result = await exec(req, action);
      expect(result.step.error).to.be.false;
    });
    it('should block commits with non-standard crypto implementations', async () => {
      const req = {};
      const action = {
        commitData: [{
          hash: '123abc',
          diff: `
            function customEncrypt(data) {
              return data.split('').map(char => 
                String.fromCharCode(char.charCodeAt(0) ^ 0x7F)
              ).join('');
            }
          `
        }],
        addStep: function(step) { this.step = step; }
      };

      const result = await exec(req, action);
      expect(result.step.error).to.be.true;
    });

    it('should allow commits without crypto issues', async () => {
      const req = {};
      const action = {
        commitData: [{
          hash: '123abc',
          diff: `
            function normalFunction() {
              return 'Hello World';
            }
          `
        }],
        addStep: function(step) { this.step = step; }
      };

      const result = await exec(req, action);
      expect(result.step.error).to.be.false;
    });

    it('should handle multiple commits', async () => {
  const req = {};
  const action = {
    commitData: [
      {
        hash: '123abc',
        diff: `function safe() { return true; }`
      },
      {
        hash: '456def',
        diff: `
          function rot13(str) {
            return str.replace(/[a-zA-Z]/g, c =>
              String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26)
            );
          }
        `
      }
    ],
    addStep: function(step) { this.step = step; }
  };

  const result = await exec(req, action);
  expect(result.step).to.have.property('error', true);
});


    it('should handle errors gracefully', async () => {
      const req = {};
      const action = {
        commitData: null,
        addStep: function(step) { this.step = step; }
      };

      const result = await exec(req, action);
      expect(result.step.error).to.be.true;
    });
  });

  describe('Pattern Detection', () => {
    it('should detect various forms of XOR encryption', () => {
      const testCases = [
        `function encrypt(a, b) { return a ^= b; }`,
        `const result = data ^ key;`,
        `function xor(plaintext, key) { return plaintext ^ key; }`,
        `return char ^ 0xFF;`
      ];

      testCases.forEach(testCode => {
        const issues = analyzeCodeForCrypto(testCode);
        const hasXORIssue = issues.some(issue => 
          issue.type === 'suspicious_operation' || 
          issue.message.toLowerCase().includes('xor')
        );
        expect(hasXORIssue, `Failed to detect XOR in: ${testCode}`).to.be.true;
      });
    });

    it('should detect custom hash implementations', () => {
      const testCode = `
        function customHash(input) {
          let hash = 0;
          for(let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash = hash & hash;
          }
          return hash;
        }
      `;

      const issues = analyzeCodeForCrypto(testCode);
      expect(issues).to.have.lengthOf.at.least(1);
      expect(issues.some(i => i.severity === 'high')).to.be.true;
    });
  });
});