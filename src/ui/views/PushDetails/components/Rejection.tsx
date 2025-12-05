import React, { useEffect, useState } from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import TextField from '@material-ui/core/TextField';
import { makeStyles } from '@material-ui/core/styles';
import { Block, ErrorOutline } from '@material-ui/icons';
import Button from '../../../components/CustomButtons/Button';
import { setEmailContactData } from '../../../services/config';

const useStyles = makeStyles({
  warningBox: {
    background: '#ffebee',
    borderRadius: '10px',
    padding: '15px 15px 5px',
    color: '#c62828',
    display: 'block',
  },
  warningHeader: {
    display: 'flex',
    flexDirection: 'row',
  },
  warningTitle: {
    fontSize: '16px',
    paddingLeft: '10px',
    fontWeight: 'bold',
  },
  warningText: {
    fontSize: '15px',
    paddingLeft: '34px',
    color: '#c62828',
  },
  warningLink: {
    color: '#c62828',
  },
});

interface RejectionProps {
  rejectFn: (rejectionData: { reason: string }) => void;
}

const Rejection: React.FC<RejectionProps> = ({ rejectFn }) => {
  const classes = useStyles();
  const [open, setOpen] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');

  useEffect(() => {
    if (open && !contactEmail) {
      setEmailContactData(setContactEmail);
    }
  }, [open, contactEmail]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setReason('');
    setOpen(false);
  };

  const handleReject = () => {
    rejectFn({ reason: reason.trim() });
  };

  const isFormValid = (): boolean => reason.trim().length > 0;

  return (
    <div>
      <Button color='danger' onClick={handleOpen}>
        Reject
      </Button>
      <Dialog fullWidth maxWidth='md' open={open} onClose={handleClose}>
        <DialogContent>
          <span className={classes.warningBox}>
            <div className={classes.warningHeader}>
              <ErrorOutline fontSize='medium' htmlColor='#c62828' />
              <span className={classes.warningTitle}>
                You are about to reject this contribution
              </span>
            </div>
            <p className={classes.warningText}>
              This action will prevent this contribution from being published.
              <br />
              Please provide a clear reason so the contributor understands why their changes were
              rejected.
            </p>
            {contactEmail && (
              <p className={classes.warningText}>
                For assistance,{' '}
                <a href={`mailto:${contactEmail}`} className={classes.warningLink}>
                  contact the Open Source Program Office
                </a>
                .
              </p>
            )}
          </span>
          <p>Rejection Reason (Required)</p>
          <TextField
            autoFocus
            multiline
            minRows={4}
            fullWidth
            variant='outlined'
            placeholder='Please explain why this contribution is being rejected...'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ marginBottom: '20px' }}
            required
            helperText={reason.trim().length === 0 ? 'Rejection reason is required.' : ' '}
          />
          <DialogActions style={{ marginRight: '15px' }}>
            <Button color='warning' onClick={handleClose}>
              Cancel
            </Button>
            <Button color='danger' onClick={handleReject} disabled={!isFormValid()}>
              <Block /> Reject
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rejection;
