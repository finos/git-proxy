import React from 'react';
import CardHeader, { CardHeaderColor } from '../../../components/Card/CardHeader';
import { StatusIcon } from './StatusIcon';
import Button from '../../../components/CustomButtons/Button';
import Attestation from './Attestation';
import ApprovalBadge from './ApprovalBadge';
import { PushActionView } from '../../../types';
import Rejection from './Rejection';
import RejectionBadge from './RejectionBadge';

const getStatusInfo = (data: PushActionView): { title: string; color: CardHeaderColor } => {
  if (data.authorised) {
    return { title: 'Approved', color: 'success' };
  }
  if (data.rejected) {
    return { title: 'Rejected', color: 'danger' };
  }
  if (data.canceled) {
    return { title: 'Canceled', color: 'warning' };
  }
  if (data.error) {
    return { title: 'Error', color: 'danger' };
  }
  return { title: 'Pending', color: 'warning' };
};

interface PushStatusHeaderProps {
  data: PushActionView;
  onCancel: () => void;
  onReject: (rejectionData: { reason: string }) => void;
  onAuthorise: (attestationData: Array<{ label: string; checked: boolean }>) => void;
}

const PushStatusHeader: React.FC<PushStatusHeaderProps> = ({
  data,
  onCancel,
  onReject,
  onAuthorise,
}) => {
  const headerData = getStatusInfo(data);
  const isPending = !data.canceled && !data.rejected && !data.authorised && !data.error;

  return (
    <CardHeader color={headerData.color} stats icon>
      <StatusIcon status={headerData.title} color={headerData.title} />
      {isPending && (
        <div style={{ display: 'inline-flex', padding: '20px' }}>
          <Button color='warning' onClick={onCancel}>
            Cancel
          </Button>
          <Rejection rejectFn={onReject} />
          <Attestation approveFn={onAuthorise} />
        </div>
      )}
      {data.attestation && data.authorised && (
        <ApprovalBadge attestation={data.attestation} autoApproved={data.autoApproved} />
      )}
      {data.rejection && data.rejected && <RejectionBadge rejection={data.rejection} />}
    </CardHeader>
  );
};

export default PushStatusHeader;
