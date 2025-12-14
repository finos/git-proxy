import { authorise, reject } from '../../db';
import { Action } from './Action';

const attemptAutoApproval = async (action: Action) => {
  try {
    const attestation = {
      timestamp: new Date(),
      automated: true,
      questions: [],
      reviewer: {
        username: 'system',
        email: 'system@git-proxy.com',
      },
    };
    await authorise(action.id, attestation);
    console.log('Push automatically approved by system.');

    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error during auto-approval:', msg);
    return false;
  }
};

const attemptAutoRejection = async (action: Action) => {
  try {
    const attestation = {
      timestamp: new Date(),
      automated: true,
      questions: [],
      reviewer: {
        username: 'system',
        email: 'system@git-proxy.com',
      },
    };
    await reject(action.id, attestation);
    console.log('Push automatically rejected by system.');

    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error during auto-rejection:', msg);
    return false;
  }
};

export { attemptAutoApproval, attemptAutoRejection };
