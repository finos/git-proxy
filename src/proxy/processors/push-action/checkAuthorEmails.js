const Step = require('../../actions').Step;
const config = require('../../../config');

const commitConfig = config.getCommitConfig();

function isEmailAllowed(email) {
  if (!email) {
    console.log('Invalid email address...');
    return false; // If the email is null, undefined, or an empty string, return false
  }

  const [emailLocal, emailDomain] = email.split('@');
  
  // Check if split was successful
  if (!emailLocal || !emailDomain) {
    console.log('Invalid email format (missing local or domain part)...');
    return false; // If either part is missing, return false
  }

  console.log({ emailLocal, emailDomain });

  // E-mail address is not a permissible domain name
  if (
    commitConfig.author.email.domain.allow &&
    !emailDomain.match(new RegExp(commitConfig.author.email.domain.allow, 'g'))
  ) {
    console.log('Bad e-mail address domain...');
    return false;
  }

  // E-mail username is not a permissible form
  if (
    commitConfig.author.email.local.block &&
    emailLocal.match(new RegExp(commitConfig.author.email.local.block, 'g'))
  ) {
    console.log('Bad e-mail address username...');
    return false;
  }

  return true;
}

// Execute if the repo is approved
const exec = async (req, action) => {
  console.log({ req, action });

  const step = new Step('checkAuthorEmails');

  const uniqueAuthorEmails = [...new Set(action.commitData.map((commit) => commit.authorEmail))];
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
exports.exec = exec;
