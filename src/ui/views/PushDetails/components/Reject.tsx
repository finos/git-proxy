import React, { useState } from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import TextField from '@material-ui/core/TextField';
import { Block, ErrorOutline } from '@material-ui/icons';
import Button from '../../../components/CustomButtons/Button';

interface RejectProps {
  rejectFn: (reason: string) => void;
}

const Reject: React.FC<RejectProps> = ({ rejectFn }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('');

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setReason('');
  };

  const handleReject = () => {
    if (!reason.trim()) {
      return;
    }
    rejectFn(reason);
    handleClose();
  };

  return (
    <div>
      <Button color='danger' onClick={handleClickOpen}>
        Reject
      </Button>
      <Dialog
        fullWidth
        maxWidth='md'
        open={open}
        onClose={handleClose}
        aria-labelledby='alert-dialog-title'
        aria-describedby='alert-dialog-description'
        style={{ margin: '0px 15px 0px 15px', padding: '20px' }}
      >
        <span
          style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '10px',
            margin: '24px 24px 12px 24px',
            padding: '24px 24px',
            color: '#000000',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <ErrorOutline fontSize='medium' htmlColor='#ffc107' />
            <span style={{ fontSize: '16px', paddingLeft: '10px', fontWeight: 'bold' }}>
              You are about to reject this contribution
            </span>
          </div>
          <p style={{ fontSize: '15px', paddingLeft: '34px' }}>
            This action will prevent this contribution from being published.
            <br />
            Please provide a reason for rejection to help the contributor understand the decision.
          </p>
        </span>
        <DialogContent style={{ margin: '0px 24px', padding: '0px' }}>
          <TextField
            autoFocus
            margin='dense'
            id='reason'
            label='Reason for rejection'
            type='text'
            fullWidth
            multiline
            rows={5}
            variant='outlined'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Provide details about why this contribution is being rejected...'
            required
          />
        </DialogContent>
        <DialogActions style={{ paddingTop: '1px', margin: '15px' }}>
          <Button color='warning' onClick={handleClose}>
            Cancel
          </Button>
          <Button color='danger' onClick={handleReject} disabled={!reason.trim()}>
            <Block /> Reject
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Reject;
