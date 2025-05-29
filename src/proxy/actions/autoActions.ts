import { authorise, reject } from '../../db';
import { Action } from './Action';

const attemptAutoApproval = async (action: Action) => {
  try {
    const attestation = {
      timestamp: new Date(),
      autoApproved: true,
    };
    await authorise(action.id, attestation);
    console.log('Push automatically approved by system.');

    return true;
  } catch (error: any) {
    console.error('Error during auto-approval:', error.message);
    return false;
  }
};

const attemptAutoRejection = async (action: Action) => {
  try {
    const attestation = {
      timestamp: new Date(),
      autoApproved: true,
    };
    await reject(action.id, attestation);
    console.log('Push automatically rejected by system.');

    return true;
  } catch (error: any) {
    console.error('Error during auto-rejection:', error.message);
    return false;
  }
};

export {
  attemptAutoApproval,
  attemptAutoRejection,
};
