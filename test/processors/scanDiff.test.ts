import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import * as processor from '../../src/proxy/processors/push-action/scanDiff';
import { Action, Step } from '../../src/proxy/actions';
import * as config from '../../src/config';
import * as db from '../../src/db';

// Load blocked literals and patterns from configuration
const commitConfig = config.getCommitConfig();
const privateOrganizations = config.getPrivateOrganizations();

const blockedLiterals = commitConfig.diff?.block?.literals ?? [];

const generateDiff = (value: string): string => {
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

const generateMultiLineDiff = (): string => {
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

const generateMultiLineDiffWithLiteral = (): string => {
  return `diff --git a/README.md b/README.md
index 8b97e49..de18d43 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,5 @@
 # gitproxy-test-delete-me
 Project to test gitproxy
+AKIAIOSFODNN7EXAMPLE
+AKIAIOSFODNN8EXAMPLE
+emdedded_blocked.Te$t.Literal?
`;
};

export const generateDiffStep = (content?: string | null): Step => {
  return {
    stepName: 'diff',
    content: content,
    error: false,
    errorMessage: null,
    blocked: false,
    blockedMessage: null,
    logs: [],
    id: '1',
    setError: vi.fn(),
    setContent: vi.fn(),
    setAsyncBlock: vi.fn(),
    log: vi.fn(),
  };
};

const TEST_REPO = {
  project: 'private-org-test',
  name: 'repo.git',
  url: 'https://github.com/private-org-test/repo.git',
  _id: undefined as any,
};

describe('Scan commit diff', () => {
  beforeAll(async () => {
    privateOrganizations[0] = 'private-org-test';
    commitConfig.diff = {
      block: {
        //n.b. the example literal includes special chars that would be interpreted as RegEx if not escaped properly
        literals: ['blocked.Te$t.Literal?'],
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

    // needed for private org tests
    const repo = await db.createRepo(TEST_REPO);
    TEST_REPO._id = repo._id;
  });

  afterAll(async () => {
    await db.deleteRepo(TEST_REPO._id);
  });

  it('should block push when diff includes AWS Access Key ID', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    const diffStep = generateDiffStep(generateDiff('AKIAIOSFODNN7EXAMPLE'));
    action.steps = [diffStep];
    action.setCommit('38cdc3e', '8a9c321');
    action.setBranch('b');
    action.setMessage('Message');

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });

  // Formatting tests
  it('should block push when diff includes multiple AWS Access Keys', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    const diffStep = generateDiffStep(generateMultiLineDiff());
    action.steps = [diffStep];
    action.setCommit('8b97e49', 'de18d43');

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
    expect(errorMessage).toContain('Line(s) of code: 3,4');
    expect(errorMessage).toContain('#1 AWS (Amazon Web Services) Access Key ID');
    expect(errorMessage).toContain('#2 AWS (Amazon Web Services) Access Key ID');
  });

  it('should block push when diff includes multiple AWS Access Keys and blocked literal with appropriate message', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    const diffStep = generateDiffStep(generateMultiLineDiffWithLiteral());
    action.steps = [diffStep];
    action.setCommit('8b97e49', 'de18d43');

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
    expect(errorMessage).toContain('Line(s) of code: 3');
    expect(errorMessage).toContain('Line(s) of code: 4');
    expect(errorMessage).toContain('Line(s) of code: 5');
    expect(errorMessage).toContain('#1 AWS (Amazon Web Services) Access Key ID');
    expect(errorMessage).toContain('#2 AWS (Amazon Web Services) Access Key ID');
    expect(errorMessage).toContain('#3 Offending Literal');
  });

  it('should block push when diff includes Google Cloud Platform API Key', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    const diffStep = generateDiffStep(generateDiff('AIza0aB7Z4Rfs23MnPqars81yzu19KbH72zaFda'));
    action.steps = [diffStep];
    action.commitFrom = '38cdc3e';
    action.commitTo = '8a9c321';

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });

  it('should block push when diff includes GitHub Personal Access Token', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    const diffStep = generateDiffStep(
      generateDiff(`ghp_${crypto.randomBytes(36).toString('hex')}`),
    );
    action.steps = [diffStep];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });

  it('should block push when diff includes GitHub Fine Grained Personal Access Token', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    const diffStep = generateDiffStep(
      generateDiff(`github_pat_1SMAGDFOYZZK3P9ndFemen_${crypto.randomBytes(59).toString('hex')}`),
    );
    action.steps = [diffStep];
    action.commitFrom = '38cdc3e';
    action.commitTo = '8a9c321';

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });

  it('should block push when diff includes GitHub Actions Token', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    const diffStep = generateDiffStep(
      generateDiff(`ghs_${crypto.randomBytes(20).toString('hex')}`),
    );
    action.steps = [diffStep];
    action.commitFrom = '38cdc3e';
    action.commitTo = '8a9c321';

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });

  it('should block push when diff includes JSON Web Token (JWT)', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    const diffStep = generateDiffStep(
      generateDiff(
        `eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ1cm46Z21haWwuY29tOmNsaWVudElkOjEyMyIsInN1YiI6IkphbmUgRG9lIiwiaWF0IjoxNTIzOTAxMjM0LCJleHAiOjE1MjM5ODc2MzR9.s5_hA8hyIT5jXfU9PlXJ-R74m5F_aPcVEFJSV-g-_kX`,
      ),
    );
    action.steps = [diffStep];
    action.commitFrom = '38cdc3e';
    action.commitTo = '8a9c321';

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });

  it('should block push when diff includes blocked literal', async () => {
    for (const literal of blockedLiterals) {
      const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
      const diffStep = generateDiffStep(generateDiff(literal));
      action.steps = [diffStep];
      action.commitFrom = '38cdc3e';
      action.commitTo = '8a9c321';

      const { error, errorMessage } = await processor.exec(null, action);

      expect(error).toBe(true);
      expect(errorMessage).toContain('Your push has been blocked');
    }
  });

  it('should allow push when no diff is present (legitimate empty diff)', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    action.steps = [generateDiffStep(null)];

    const result = await processor.exec(null, action);
    const scanDiffStep = result.steps.find((s) => s.stepName === 'scanDiff');

    expect(scanDiffStep?.error).toBe(false);
  });

  it('should block push when diff is not a string', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    action.steps = [generateDiffStep(1337 as any)];

    const { error, errorMessage } = await processor.exec(null, action);

    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });

  it('should allow push when diff has no secrets or sensitive information', async () => {
    const action = new Action('1', 'type', 'method', 1, 'test/repo.git');
    action.steps = [generateDiffStep(generateDiff(''))];
    action.commitFrom = '38cdc3e';
    action.commitTo = '8a9c321';

    const { error } = await processor.exec(null, action);

    expect(error).toBe(false);
  });

  it('should allow push when diff includes provider token in private organization', async () => {
    const action = new Action(
      '1',
      'type',
      'method',
      1,
      'https://github.com/private-org-test/repo.git', // URL needs to be parseable AND exist in DB
    );
    const diffStep = generateDiffStep(generateDiff('AKIAIOSFODNN7EXAMPLE'));
    action.steps = [diffStep];

    const { error } = await processor.exec(null, action);

    expect(error).toBe(false);
  });
});
