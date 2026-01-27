import { Action, Step } from '../../actions';
import { getCommitConfig } from '../../../config';

const isMessageAllowed = (commitMessage: any): string | null => {
  try {
    const commitConfig = getCommitConfig();

    // Commit message is empty, i.e. '', null or undefined
    if (!commitMessage) {
      // console.log('No commit message included...');
      return 'No commit message included...';
    }

    // Validation for configured block pattern(s) check...
    if (typeof commitMessage !== 'string') {
      // console.log('A non-string value has been captured for the commit message...');
      return 'A non-string value has been captured for the commit message...';
    }

    // Configured blocked literals and patterns
    const blockedLiterals: string[] = commitConfig.message?.block?.literals ?? [];
    const blockedPatterns: string[] = commitConfig.message?.block?.patterns ?? [];

    // Find all instances of blocked literals and patterns in commit message
    const positiveLiterals = blockedLiterals.map((literal: string) =>
      commitMessage.toLowerCase().includes(literal.toLowerCase()),
    );

    const positivePatterns = blockedPatterns.map((pattern: string) =>
      commitMessage.match(new RegExp(pattern, 'gi')),
    );

    // Flatten any positive literal and pattern results into a 1D array
    const literalMatches = positiveLiterals.flat().filter((result) => !!result);
    const patternMatches = positivePatterns.flat().filter((result) => !!result);

    // Commit message matches configured block pattern(s)
    if (literalMatches.length || patternMatches.length) {
      // console.log('Commit message is blocked via configured literals/patterns...');
      return 'Commit message is blocked via configured literals/patterns...';
    }
  } catch (error) {
    // console.log('Invalid regex pattern...');
    return 'Invalid regex pattern...';
  }

  return null;
};

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkCommitMessages');

  const uniqueCommitMessages = [...new Set(action.commitData?.map((commit) => commit.message))];

  // const illegalMessages = uniqueCommitMessages.filter((message) => !isMessageAllowed(message));
  const illegalMessages = uniqueCommitMessages.filter(
    (message) => isMessageAllowed(message) !== null,
  );

  if (illegalMessages.length > 0) {
    // console.log(`The following commit messages are illegal: ${illegalMessages}`);

    illegalMessages.forEach((message) => {
      const error = isMessageAllowed(message);
      step.log(
        `Illegal commit message detected: "${message}" - Reason: ${error ?? 'Unknown reason'}`,
      );
    });

    // step.error = true;
    // step.log(`The following commit messages are illegal: ${illegalMessages}`);
    step.setError(
      `\n\n\nYour push has been blocked.\nPlease ensure your commit message(s) does not contain sensitive information or URLs.\n\nThe following commit messages are illegal: ${JSON.stringify(illegalMessages)}\n\n`,
    );

    action.addStep(step);
    return action;
  }

  // console.log(`The following commit messages are legal: ${uniqueCommitMessages}`);
  step.log(`The following commit messages are legal: ${JSON.stringify(uniqueCommitMessages)}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkCommitMessages.exec';

export { exec };
