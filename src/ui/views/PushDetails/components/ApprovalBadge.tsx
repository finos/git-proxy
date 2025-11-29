import React from 'react';
import moment from 'moment/moment';
import { CheckCircle } from '@material-ui/icons';
import Tooltip from '@material-ui/core/Tooltip';
import AttestationView from './AttestationView';
import { AttestationFormData } from '../../../types';
import { Attestation } from '../../../../proxy/processors/types';
import UserLink from '../../../components/UserLink/UserLink';

interface ApprovalBadgeProps {
  attestation: Attestation;
  autoApproved?: boolean;
}

const ApprovalBadge: React.FC<ApprovalBadgeProps> = ({ attestation, autoApproved }) => {
  const [attestationOpen, setAttestationOpen] = React.useState<boolean>(false);

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
            cursor: autoApproved ? 'default' : 'pointer',
            transform: 'scale(0.65)',
            opacity: autoApproved ? 0.5 : 1,
          }}
          onClick={() => {
            if (!autoApproved) {
              setAttestationOpen(true);
            }
          }}
          htmlColor='green'
        />
      </span>

      {autoApproved ? (
        <div style={{ paddingTop: '15px' }}>
          <p>
            <strong>Auto-approved by system</strong>
          </p>
        </div>
      ) : (
        <div style={{ paddingTop: '15px' }}>
          <p>
            <UserLink username={attestation.reviewer.username} /> approved this contribution
          </p>
        </div>
      )}

      <Tooltip title={moment(attestation.timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a')} arrow>
        <kbd style={{ color: 'black', float: 'right' }}>
          {moment(attestation.timestamp).fromNow()}
        </kbd>
      </Tooltip>

      {!autoApproved && (
        <AttestationView
          data={attestation as AttestationFormData}
          attestation={attestationOpen}
          setAttestation={setAttestationOpen}
        />
      )}
    </div>
  );
};

export default ApprovalBadge;
