const Step = require('../../actions').Step;

// Common encryption-related patterns and keywords
const CRYPTO_PATTERNS = {
  // Known non-standard encryption algorithms
  nonStandardAlgorithms: [
    'xor\\s*\\(',
    'rot13',
    'caesar\\s*cipher',
    'custom\\s*encrypt',
    'simple\\s*encrypt',
    'homebrew\\s*crypto',
    'custom\\s*hash'
  ],

  // Suspicious operations that might indicate custom crypto Implementation
  suspiciousOperations: [
    'bit\\s*shift',
    'bit\\s*rotate',
    '\\^=',  
    '\\^',   
    '>>>',
    '<<<',
    'shuffle\\s*bytes'
  ],

  // Common encryption-related variable names
  suspiciousVariables: [
    'cipher',
    'encrypt',
    'decrypt',
    'scramble',
    'salt(?!\\w)',
    'iv(?!\\w)',
    'nonce'
  ]
};

function analyzeCodeForCrypto(diffContent) {
  // file access
  
  const issues = [];
  // Check for above mentioned cryto Patterns
  if(!diffContent) return issues;

  CRYPTO_PATTERNS.nonStandardAlgorithms.forEach(pattern => {
    const regex = new RegExp(pattern, 'gi');
    const matches = diffContent.match(regex);
    if (matches) {
      issues.push({
        type: 'non_standard_algorithm',
        pattern: pattern,
        matches: matches,
        severity: 'high',
        message: `Detected possible non-standard encryption algorithm: ${matches.join(', ')}`
      });
    }
  });

  CRYPTO_PATTERNS.suspiciousOperations.forEach(pattern => {
    const regex = new RegExp(pattern, 'gi');
    const matches = diffContent.match(regex);
    if (matches) {
      issues.push({
        type: 'suspicious_operation',
        pattern: pattern,
        matches: matches,
        severity: 'medium',
        message: `Detected suspicious cryptographic operation: ${matches.join(', ')}`
      });
    }
  });

  CRYPTO_PATTERNS.suspiciousVariables.forEach(pattern => {
    const regex = new RegExp(pattern, 'gi');
    const matches = diffContent.match(regex);
    if (matches) {
      issues.push({
        type: 'suspicious_variable',
        pattern: pattern,
        matches: matches,
        severity: 'low',
        message: `Detected potential encryption-related variable: ${matches.join(', ')}`
      });
    }
  });

  return issues;
}

const exec = async (req, action) => {

  const step = new Step('checkCryptoImplementation');

  try {
    let hasIssues = false;
    const allIssues = [];
    console.log("action:",action);
    for (const commit of action.commitData) {
      const diff = commit.diff || '';
      console.log("diff",diff);
     
      const issues = analyzeCodeForCrypto(diff);

      if (issues.length > 0) {
        hasIssues = true;
        allIssues.push({
          commit: commit.hash,
          issues: issues
        });
      }
    }

    if (hasIssues) {
      step.error = true;

      const errorMessage = allIssues.map(commitIssues => {
        return `Commit ${commitIssues.commit}:\n` +
          commitIssues.issues.map(issue => 
            `- ${issue.severity.toUpperCase()}: ${issue.message}`
          ).join('\n');
      }).join('\n\n');

      step.setError(
        '\n\nYour push has been blocked.\n' +
        'Potential non-standard cryptographic implementations detected:\n\n' +
        `${errorMessage}\n\n` +
        'Please use standard cryptographic libraries instead of custom implementations.\n' +
        'Recommended: Use established libraries like crypto, node-forge, or Web Crypto API.\n'
      );
    }

    action.addStep(step);
    return action;
  } catch (error) {
    step.error = true;
    step.setError(`Error analyzing crypto implementation: ${error.message}`);
    action.addStep(step);
    return action;
  }
};

exec.displayName = 'checkCryptoImplementation.exec';
exports.exec = exec;
exports.analyzeCodeForCrypto = analyzeCodeForCrypto;