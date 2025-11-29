import React from 'react';
import Icon from '@material-ui/core/Icon';
import { Block, Cancel, Error, CheckCircle, Visibility } from '@material-ui/icons';
import CardIcon from '../../../components/Card/CardIcon';
import { CardHeaderColor } from '../../../components/Card/CardHeader';

interface StatusIconProps {
  status: string;
  colour: CardHeaderColor;
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status, colour }) => {
  const renderIcon = () => {
    switch (status) {
      case 'Approved':
        return <CheckCircle />;
      case 'Pending':
        return <Visibility />;
      case 'Cancelled':
        return <Cancel />;
      case 'Rejected':
        return <Block />;
      case 'Error':
        return <Error />;
      default:
        return <Icon />;
    }
  };

  return (
    <CardIcon color={colour}>
      {renderIcon()}
      <h3>{status}</h3>
    </CardIcon>
  );
};
