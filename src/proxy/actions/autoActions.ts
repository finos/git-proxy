import { authorise, reject } from '../../db';
import { handleAndLogError } from '../../utils/errors';
import { CompletedAttestation } from '../processors/types';
import { Action } from './Action';

const attemptAutoApproval = async (action: Action) => {
  try {
    const attestation: CompletedAttestation = {
      timestamp: new Date(),
      automated: true,
      answers: [],
      reviewer: {
        username: 'system',
        email: 'system@git-proxy.com',
      },
    };
    await authorise(action.id, attestation);
    console.log('Push automatically approved by system.');

    return true;
  } catch (error: unknown) {
    handleAndLogError(error, 'Error during auto-approval');
    return false;
  }
};

const attemptAutoRejection = async (action: Action) => {
  try {
    const attestation: CompletedAttestation = {
      timestamp: new Date(),
      automated: true,
      answers: [],
      reviewer: {
        username: 'system',
        email: 'system@git-proxy.com',
      },
    };
    await reject(action.id, attestation);
    console.log('Push automatically rejected by system.');

    return true;
  } catch (error: unknown) {
    handleAndLogError(error, 'Error during auto-rejection');
    return false;
  }
};

export { attemptAutoApproval, attemptAutoRejection };
