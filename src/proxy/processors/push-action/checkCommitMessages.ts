import { Action, Step } from '../../actions';
import { getCommitConfig } from '../../../config';

const commitConfig = getCommitConfig();

const isMessageAllowed = (commitMessage: string): boolean => {
  console.log(`isMessageAllowed(${commitMessage})`);

  // Commit message is empty, i.e. '', null or undefined
  if (!commitMessage) {
    console.log('No commit message included...');
    return false;
  }

  // Validation for configured block pattern(s) check...
  if (typeof commitMessage !== 'string') {
    console.log('A non-string value has been captured for the commit message...');
    return false;
  }

  // Configured blocked literals
  const blockedLiterals: string[] = commitConfig.message.block.literals;

  // Configured blocked patterns
  const blockedPatterns: string[] = commitConfig.message.block.patterns;

  // Find all instances of blocked literals in commit message...
  const positiveLiterals = blockedLiterals.map((literal: string) =>
    commitMessage.toLowerCase().includes(literal.toLowerCase()),
  );

  // Find all instances of blocked patterns in commit message...
  const positivePatterns = blockedPatterns.map((pattern: string) =>
    commitMessage.match(new RegExp(pattern, 'gi')),
  );

  // Flatten any positive literal results into a 1D array...
  const literalMatches = positiveLiterals.flat().filter((result) => !!result);

  // Flatten any positive pattern results into a 1D array...
  const patternMatches = positivePatterns.flat().filter((result) => !!result);

  // Commit message matches configured block pattern(s)
  if (literalMatches.length || patternMatches.length) {
    console.log('Commit message is blocked via configured literals/patterns...');
    return false;
  }

  return true;
};

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  console.log({ req, action });

  const step = new Step('checkCommitMessages');

  const uniqueCommitMessages = [...new Set(action.commitData?.map((commit) => commit.message))];
  console.log({ uniqueCommitMessages });

  const illegalMessages = uniqueCommitMessages.filter((message) => !isMessageAllowed(message));
  console.log({ illegalMessages });

  const usingIllegalMessages = illegalMessages.length > 0;
  console.log({ usingIllegalMessages });

  if (usingIllegalMessages) {
    console.log(`The following commit messages are illegal: ${illegalMessages}`);

    step.error = true;
    step.log(`The following commit messages are illegal: ${illegalMessages}`);
    step.setError(
      '\n\n\n\nYour push has been blocked.\nPlease ensure your commit message(s) does not contain sensitive information or URLs.\n\n\n',
    );

    action.addStep(step);
    return action;
  }

  console.log(`The following commit messages are legal: ${uniqueCommitMessages}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkCommitMessages.exec';

export { exec };
