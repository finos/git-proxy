import React, { useEffect, useState } from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import { CheckCircle, ErrorOutline } from '@material-ui/icons';
import Button from '../../../components/CustomButtons/Button';
import AttestationForm, { FormQuestion } from './AttestationForm';
import { getAttestationConfig, getURLShortener, getEmailContact } from '../../../services/config';

interface AttestationProps {
  approveFn: (data: { label: string; checked: boolean }[]) => void;
}

const Attestation: React.FC<AttestationProps> = ({ approveFn }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<FormQuestion[]>([]);
  const [urlShortener, setURLShortener] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');

  useEffect(() => {
    if (!open) {
      getAttestationConfig(setFormData);
    }

    if (open) {
      if (!urlShortener) {
        getURLShortener(setURLShortener);
      }
      if (!contactEmail) {
        getEmailContact(setContactEmail);
      }
    }
  }, [open, urlShortener, contactEmail]);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleApprove = () => {
    const data = formData.map((question) => ({
      label: question.label,
      checked: question.checked,
    }));
    approveFn(data);
  };

  return (
    <div>
      <Button color='success' onClick={handleClickOpen}>
        Approve
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
            background: '#eeeeee',
            borderRadius: '10px',
            margin: '24px 24px',
            padding: '24px 24px',
            color: 'black',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <ErrorOutline fontSize='medium' htmlColor='black' />
            <span style={{ fontSize: '16px', paddingLeft: '10px', fontWeight: 'bold' }}>
              You are about to approve a contribution for publication to GitHub
            </span>
          </div>
          <p style={{ fontSize: '15px', paddingLeft: '34px' }}>
            Feeling uneasy with approving this contribution?
            <br />
            Review the company open source contribution policy or{' '}
            <a href={`mailto:${contactEmail}`}>contact the Open Source Program Office</a>.
          </p>
        </span>
        <DialogContent style={{ margin: '0px 15px 0px 0px' }}>
          <p>By approving this contribution, I confirm that:</p>
          <AttestationForm formData={formData} passFormData={setFormData} />
        </DialogContent>
        <DialogActions style={{ paddingTop: '15px', margin: '15px' }}>
          <Button color='warning' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            color='success'
            onClick={handleApprove}
            autoFocus
            disabled={!formData.every((question) => question.checked)}
          >
            <CheckCircle /> Approve
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Attestation;
