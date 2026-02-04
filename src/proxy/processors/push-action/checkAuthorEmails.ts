import { Action, Step } from '../../actions';
import { getCommitConfig } from '../../../config';
import { CommitData } from '../types';
import { isEmail } from 'validator';

const isEmailAllowed = (email: string): boolean => {
  const commitConfig = getCommitConfig();

  if (!email || !isEmail(email)) {
    return false;
  }

  const [emailLocal, emailDomain] = email.split('@');

  if (
    commitConfig?.author?.email?.domain?.allow &&
    !new RegExp(commitConfig.author.email.domain.allow, 'gi').test(emailDomain)
  ) {
    return false;
  }

  if (
    commitConfig?.author?.email?.local?.block &&
    new RegExp(commitConfig.author.email.local.block, 'gi').test(emailLocal)
  ) {
    return false;
  }

  return true;
};

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkAuthorEmails');

  const uniqueAuthorEmails = [
    ...new Set(action.commitData?.map((commitData: CommitData) => commitData.authorEmail)),
  ];

  const illegalEmails = uniqueAuthorEmails.filter((email) => !isEmailAllowed(email));

  if (illegalEmails.length > 0) {
    step.error = true;
    step.log(`The following commit author e-mails are illegal: ${illegalEmails}`);
    step.setError(
      'Your push has been blocked. Please verify your Git configured e-mail address is valid (e.g. john.smith@example.com)',
    );

    action.addStep(step);
    return action;
  }

  step.log(`The following commit author e-mails are legal: ${uniqueAuthorEmails}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkAuthorEmails.exec';

export { exec };
