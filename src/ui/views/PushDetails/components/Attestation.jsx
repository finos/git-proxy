import React, { useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { CheckCircle, ErrorOutline } from '@mui/icons-material';
import Button from '../../../components/CustomButtons/Button';
import AttestationForm from './AttestationForm';

import { getAttestationConfig, getURLShortener, getEmailContact } from '../../../services/config';

export default function Attestation(props) {
  const [open, setOpen] = React.useState(false);
  const [formData, setFormData] = React.useState([]);
  const [urlShortener, setURLShortener] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');

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
  }, [open]);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleApprove = () => {
    const data = formData.map((question) => {
      return {
        label: question.label,
        checked: question.checked,
      };
    });
    props.approveFn(data);
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
            disabled={!formData.every((question) => !!question.checked)}
          >
            <CheckCircle /> Approve
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
