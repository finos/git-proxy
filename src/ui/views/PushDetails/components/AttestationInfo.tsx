import React from 'react';
import moment from 'moment';
import { CheckCircle } from '@material-ui/icons';
import Tooltip from '@material-ui/core/Tooltip';
import UserLink from '../../../components/UserLink/UserLink';
import AttestationView from './AttestationView';
import { AttestationFormData, PushActionView } from '../../../types';

interface AttestationInfoProps {
  push: PushActionView;
  isGitHub: boolean;
  attestation: boolean;
  setAttestation: (value: boolean) => void;
}

const AttestationInfo: React.FC<AttestationInfoProps> = ({
  push,
  isGitHub,
  attestation,
  setAttestation,
}) => {
  if (!push.attestation || !push.authorised) {
    return null;
  }

  return (
    <div
      style={{
        background: '#eee',
        padding: '10px 20px 10px 20px',
        borderRadius: '10px',
        color: 'black',
        marginTop: '15px',
        float: 'right',
        position: 'relative',
        textAlign: 'left',
      }}
    >
      <span style={{ position: 'absolute', top: 0, right: 0 }}>
        <CheckCircle
          style={{
            cursor: push.autoApproved ? 'default' : 'pointer',
            transform: 'scale(0.65)',
            opacity: push.autoApproved ? 0.5 : 1,
          }}
          onClick={() => {
            if (!push.autoApproved) {
              setAttestation(true);
            }
          }}
          htmlColor='green'
        />
      </span>

      {push.autoApproved ? (
        <div style={{ paddingTop: '15px' }}>
          <p>
            <strong>Auto-approved by system</strong>
          </p>
        </div>
      ) : (
        <>
          {isGitHub && (
            <UserLink username={push.attestation.reviewer.username}>
              <img
                style={{ width: '45px', borderRadius: '20px' }}
                src={`https://github.com/${push.attestation.reviewer.gitAccount}.png`}
              />
            </UserLink>
          )}
          <div>
            <p>
              {isGitHub && (
                <UserLink username={push.attestation.reviewer.username}>
                  {push.attestation.reviewer.gitAccount}
                </UserLink>
              )}
              {!isGitHub && <UserLink username={push.attestation.reviewer.username} />} approved
              this contribution
            </p>
          </div>
        </>
      )}

      <Tooltip
        title={moment(push.attestation.timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a')}
        arrow
      >
        <kbd style={{ color: 'black', float: 'right' }}>
          {moment(push.attestation.timestamp).fromNow()}
        </kbd>
      </Tooltip>

      {!push.autoApproved && (
        <AttestationView
          data={push.attestation as AttestationFormData}
          attestation={attestation}
          setAttestation={setAttestation}
        />
      )}
    </div>
  );
};

export default AttestationInfo;
