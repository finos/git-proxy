const db = require('../../db');

const attemptAutoApproval = async (action) => {
  try {
    const attestation = {
      timestamp: new Date(),
      autoApproved: true,
    };
    await db.authorise(action.id, attestation);
    console.log('Push automatically approved by system.');

    return true;
  } catch (error) {
    console.error('Error during auto-approval:', error.message);
    return false;
  }
};

const attemptAutoRejection = async (action) => {
  try {
    const attestation = {
      timestamp: new Date(),
      autoApproved: true,
    };
    await db.reject(action.id, attestation);
    console.log('Push automatically rejected by system.');

    return true;
  } catch (error) {
    console.error('Error during auto-rejection:', error.message);
    return false;
  }
};

module.exports = {
  attemptAutoApproval,
  attemptAutoRejection,
};
