const Step = require('../../actions').Step;
const config = require('../../../config');

const commitConfig = config.getCommitConfig();
const privateOrganizations = config.getPrivateOrganizations();

const isDiffLegal = (diff, organization) => {
  // Commit diff is empty, i.e. '', null or undefined
  if (!diff) {
    console.log('No commit diff...');
    return false;
  }

  // Validation for configured block pattern(s) check...
  if (typeof diff !== 'string') {
    console.log('A non-string value has been captured for the commit diff...');
    return false;
  }

  // Configured blocked literals
  const blockedLiterals = commitConfig.diff.block.literals;

  // Configured blocked patterns
  const blockedPatterns = commitConfig.diff.block.patterns;

  // Configured blocked providers
  const blockedProviders = Object.values(commitConfig.diff.block.providers);

  // Find all instances of blocked literals in diff...
  const positiveLiterals = blockedLiterals.map((literal) =>
    diff.toLowerCase().includes(literal.toLowerCase()),
  );

  // Find all instances of blocked patterns in diff...
  const positivePatterns = blockedPatterns.map((pattern) => diff.match(new RegExp(pattern, 'gi')));

  // Find all instances of blocked providers in diff...
  const positiveProviders = blockedProviders.map((pattern) =>
    diff.match(new RegExp(pattern, 'gi')),
  );

  console.log({ positiveLiterals });
  console.log({ positivePatterns });
  console.log({ positiveProviders });

  // Flatten any positive literal results into a 1D array...
  const literalMatches = positiveLiterals.flat().filter((result) => !!result);

  // Flatten any positive pattern results into a 1D array...
  const patternMatches = positivePatterns.flat().filter((result) => !!result);

  // Flatten any positive pattern results into a 1D array...
  const providerMatches =
    organization && privateOrganizations.includes(organization) // Return empty results for private organizations
      ? []
      : positiveProviders.flat().filter((result) => !!result);

  console.log({ literalMatches });
  console.log({ patternMatches });
  console.log({ providerMatches });

  // Diff matches configured block pattern(s)
  if (literalMatches.length || patternMatches.length || providerMatches.length) {
    console.log('Diff is blocked via configured literals/patterns/providers...');
    return false;
  }

  return true;
};

const exec = async (req, action) => {
  const step = new Step('scanDiff');

  const { steps, commitFrom, commitTo } = action;
  console.log(`Scanning diff: ${commitFrom}:${commitTo}`);

  const diff = steps.find((s) => s.stepName === 'diff')?.content;

  const legalDiff = isDiffLegal(diff, action.project);

  if (!legalDiff) {
    console.log(`The following diff is illegal: ${commitFrom}:${commitTo}`);

    step.error = true;
    step.log(`The following diff is illegal: ${commitFrom}:${commitTo}`);
    step.setError(
      '\n\n\n\nYour push has been blocked.\nPlease ensure your code does not contain sensitive information or URLs.\n\n\n',
    );

    action.addStep(step);
    return action;
  }

  action.addStep(step);
  return action;
};

exec.displayName = 'scanDiff.exec';
exports.exec = exec;
