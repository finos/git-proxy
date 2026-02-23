import React from 'react';
import moment from 'moment';
import { Block } from '@material-ui/icons';
import Tooltip from '@material-ui/core/Tooltip';
import UserLink from '../../../components/UserLink/UserLink';
import { PushActionView } from '../../../types';

interface RejectionInfoProps {
  push: PushActionView;
}

const RejectionInfo: React.FC<RejectionInfoProps> = ({ push }) => {
  if (!push.rejection || !push.rejected) {
    return null;
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
        padding: '10px 20px 10px 20px',
        borderRadius: '12px',
        color: '#333',
        marginTop: '15px',
        float: 'right',
        position: 'relative',
        textAlign: 'left',
        boxShadow: '0 2px 8px rgba(211, 47, 47, 0.15)',
        border: '1px solid rgba(211, 47, 47, 0.2)',
      }}
    >
      <span style={{ position: 'absolute', top: 0, right: 0 }}>
        <Block
          style={{
            cursor: 'default',
            transform: 'scale(0.65)',
          }}
          htmlColor='#d32f2f'
        />
      </span>

      {push.autoRejected ? (
        <div style={{ paddingTop: '15px' }}>
          <p>
            <strong>Auto-rejected by system</strong>
          </p>
        </div>
      ) : (
        <>
          <div style={{ paddingTop: '15px' }}>
            <p>
              <UserLink username={push.rejection.reviewer.username} /> rejected this contribution
            </p>
          </div>
        </>
      )}

      {push.rejection.reason && (
        <div
          style={{
            marginTop: '10px',
            padding: '12px 14px',
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '6px',
            borderLeft: '4px solid #d32f2f',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: '13px',
              color: '#c62828',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Reason
          </p>
          <p
            style={{
              margin: '6px 0 0 0',
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#333',
            }}
          >
            {push.rejection.reason}
          </p>
        </div>
      )}

      <Tooltip
        title={moment(push.rejection.timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a')}
        arrow
      >
        <kbd style={{ color: 'black', float: 'right', marginTop: '10px' }}>
          {moment(push.rejection.timestamp).fromNow()}
        </kbd>
      </Tooltip>
    </div>
  );
};

export default RejectionInfo;
