const chai = require('chai');
const crypto = require('crypto');
const processor = require('../src/proxy/processors/push-action/scanDiff');
const { Action } = require('../src/proxy/actions/Action');
const { expect } = chai;
const config = require('../src/config');
chai.should();

// Load blocked literals and patterns from configuration...
const commitConfig = require('../src/config/index').getCommitConfig();
const privateOrganizations = config.getPrivateOrganizations();

const blockedLiterals = commitConfig.diff.block.literals;
const generateDiff = (value) => {
  return `diff --git a/package.json b/package.json
index 38cdc3e..8a9c321 100644
--- a/package.json
+++ b/package.json
@@ -36,7 +36,7 @@
     "express-session": "^1.17.1",
     "generate-password": "^1.5.1",
     "history": "5.3.0",
-    "lodash": "^4.17.21",
+    "lodash": "^4.1${value}7.21",
     "moment": "^2.29.4",
     "mongodb": "^5.0",
     "nodemailer": "^6.6.1",
  `;
};

const generateMultiLineDiff = () => {
  return `diff --git a/README.md b/README.md
index 8b97e49..de18d43 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,5 @@
 # gitproxy-test-delete-me
 Project to test gitproxy
+AKIAIOSFODNN7EXAMPLE
+AKIAIOSFODNN7EXAMPLE
+AKIAIOSFODNN8EXAMPLE
`;
};

const generateMultiLineDiffWithLiteral = () => {
  return `diff --git a/README.md b/README.md
index 8b97e49..de18d43 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,5 @@
 # gitproxy-test-delete-me
 Project to test gitproxy
+AKIAIOSFODNN7EXAMPLE
+AKIAIOSFODNN8EXAMPLE
+blockedTestLiteral
`;
};
describe('Scan commit diff...', async () => {
  privateOrganizations[0] = 'private-org-test';
  commitConfig.diff = {
    block: {
      literals: ['blockedTestLiteral'],
      patterns: [],
      providers: {
        'AWS (Amazon Web Services) Access Key ID':
          'A(AG|CC|GP|ID|IP|KI|NP|NV|PK|RO|SC|SI)A[A-Z0-9]{16}',
        'Google Cloud Platform API Key': 'AIza[0-9A-Za-z-_]{35}',
        'GitHub Personal Access Token': 'ghp_[a-zA-Z0-9]{36}',
        'GitHub Fine Grained Personal Access Token': 'github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}',
        'GitHub Actions Token': 'ghs_[a-zA-Z0-9]{36}',
        'JSON Web Token (JWT)': 'ey[A-Za-z0-9-_=]{18,}.ey[A-Za-z0-9-_=]{18,}.[A-Za-z0-9-_.]{18,}',
      },
    },
  };
  it('A diff including an AWS (Amazon Web Services) Access Key ID blocks the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateDiff('AKIAIOSFODNN7EXAMPLE'),
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);
    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  // Formatting test
  it('A diff including multiple AWS (Amazon Web Services) Access Keys ID blocks the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateMultiLineDiff(),
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
    expect(errorMessage).to.contains('Line(s) of code: 3,4'); // blocked lines
    expect(errorMessage).to.contains('#1 AWS (Amazon Web Services) Access Key ID'); // type of error
    expect(errorMessage).to.contains('#2 AWS (Amazon Web Services) Access Key ID'); // type of error
  });

  // Formatting test
  it('A diff including multiple AWS Access Keys ID and Literal blocks the proxy with appropriate message...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateMultiLineDiffWithLiteral(),
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
    expect(errorMessage).to.contains('Line(s) of code: 3'); // blocked lines
    expect(errorMessage).to.contains('Line(s) of code: 4'); // blocked lines
    expect(errorMessage).to.contains('Line(s) of code: 5'); // blocked lines
    expect(errorMessage).to.contains('#1 AWS (Amazon Web Services) Access Key ID'); // type of error
    expect(errorMessage).to.contains('#2 AWS (Amazon Web Services) Access Key ID'); // type of error
    expect(errorMessage).to.contains('#3 Offending Literal');
  });

  it('A diff including a Google Cloud Platform API Key blocks the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateDiff('AIza0aB7Z4Rfs23MnPqars81yzu19KbH72zaFda'),
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  it('A diff including a GitHub Personal Access Token blocks the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateDiff(`ghp_${crypto.randomBytes(36).toString('hex')}`),
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  it('A diff including a GitHub Fine Grained Personal Access Token blocks the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateDiff(
          `github_pat_1SMAGDFOYZZK3P9ndFemen_${crypto.randomBytes(59).toString('hex')}`,
        ),
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  it('A diff including a GitHub Actions Token blocks the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateDiff(`ghs_${crypto.randomBytes(20).toString('hex')}`),
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  it('A diff including a JSON Web Token (JWT) blocks the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateDiff(
          `eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ1cm46Z21haWwuY29tOmNsaWVudElkOjEyMyIsInN1YiI6IkphbmUgRG9lIiwiaWF0IjoxNTIzOTAxMjM0LCJleHAiOjE1MjM5ODc2MzR9.s5_hA8hyIT5jXfU9PlXJ-R74m5F_aPcVEFJSV-g-_kX`,
        ),
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  it('A diff including a blocked literal blocks the proxy...', async () => {
    for (const [literal] of blockedLiterals.entries()) {
      const action = new Action('1', 'type', 'method', 1, 'project/name');
      action.steps = [
        {
          stepName: 'diff',
          content: generateDiff(literal),
        },
      ];

      const { error, errorMessage } = await processor.exec(null, action);

      expect(error).to.be.true;
      expect(errorMessage).to.contains('Your push has been blocked');
    }
  });
  it('When no diff is present, the proxy is blocked...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: null,
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  it('When diff is not a string, the proxy is blocked...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: 1337,
      },
    ];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  it('A diff with no secrets or sensitive information does not block the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'project/name');
    action.steps = [
      {
        stepName: 'diff',
        content: generateDiff(''),
      },
    ];

    const { error } = await processor.exec(null, action);
    expect(error).to.be.false;
  });

  it('A diff including a provider token in a private organization does not block the proxy...', async () => {
    const action = new Action('1', 'type', 'method', 1, 'private-org-test');
    action.steps = [
      {
        stepName: 'diff',
        content: generateDiff('AKIAIOSFODNN7EXAMPLE'),
      },
    ];

    const { error } = await processor.exec(null, action);
    expect(error).to.be.false;
  });
});
