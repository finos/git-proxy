import { Action, Step } from '../../actions';
import { getCommitConfig } from '../../../config';
import { Commit } from '../../actions/Action';
import { isEmail } from 'validator';

const commitConfig = getCommitConfig();

const isEmailAllowed = (email: string): boolean => {
  if (!email || !isEmail(email)) {
    return false;
  }

  const [emailLocal, emailDomain] = email.split('@');

  if (
    commitConfig.author.email.domain.allow &&
    !new RegExp(commitConfig.author.email.domain.allow, 'g').test(emailDomain)
  ) {
    return false;
  }

  if (
    commitConfig.author.email.local.block &&
    new RegExp(commitConfig.author.email.local.block, 'g').test(emailLocal)
  ) {
    return false;
  }

  return true;
};

const exec = async (req: any, action: Action): Promise<Action> => {
  console.log({ req, action });

  const step = new Step('checkAuthorEmails');

  const uniqueAuthorEmails = [
    ...new Set(action.commitData?.map((commit: Commit) => commit.authorEmail)),
  ];
  console.log({ uniqueAuthorEmails });

  const illegalEmails = uniqueAuthorEmails.filter((email) => !isEmailAllowed(email));
  console.log({ illegalEmails });

  const usingIllegalEmails = illegalEmails.length > 0;
  console.log({ usingIllegalEmails });

  if (usingIllegalEmails) {
    console.log(`The following commit author e-mails are illegal: ${illegalEmails}`);

    step.error = true;
    step.log(`The following commit author e-mails are illegal: ${illegalEmails}`);
    step.setError(
      'Your push has been blocked. Please verify your Git configured e-mail address is valid (e.g. john.smith@example.com)',
    );

    action.addStep(step);
    return action;
  }

  console.log(`The following commit author e-mails are legal: ${uniqueAuthorEmails}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkAuthorEmails.exec';

export { exec };
