import React from 'react';
import moment from 'moment';
import { Block } from '@material-ui/icons';
import Tooltip from '@material-ui/core/Tooltip';
import { Rejection } from '../../../../proxy/processors/types';
import UserLink from '../../../components/UserLink/UserLink';

interface RejectionBadgeProps {
  rejection: Rejection;
}

const RejectionBadge: React.FC<RejectionBadgeProps> = ({ rejection }) => {
  return (
    <div
      style={{
        background: '#ffebee',
        padding: '10px 20px 10px 20px',
        borderRadius: '10px',
        color: '#c62828',
        marginTop: '15px',
        float: 'right',
        position: 'relative',
        textAlign: 'left',
      }}
    >
      <span style={{ position: 'absolute', top: 0, right: 0 }}>
        <Block style={{ transform: 'scale(0.65)' }} htmlColor='#c62828' />
      </span>

      <div style={{ paddingTop: '15px' }}>
        <p>
          <UserLink username={rejection.reviewer.username} /> rejected this contribution.
        </p>
        <p style={{ paddingTop: '10px', fontSize: '14px' }}>
          <strong>Reason:</strong> {rejection.reason}
        </p>

        <Tooltip title={moment(rejection.timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a')} arrow>
          <kbd style={{ color: '#c62828', float: 'right' }}>
            {moment(rejection.timestamp).fromNow()}
          </kbd>
        </Tooltip>
      </div>
    </div>
  );
};

export default RejectionBadge;
