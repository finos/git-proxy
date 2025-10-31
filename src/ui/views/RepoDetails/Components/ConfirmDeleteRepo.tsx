import React, { useState } from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import { Button, DialogContentText, TextField } from '@material-ui/core';
import DialogActions from '@material-ui/core/DialogActions';

interface ConfirmDeleteRepoProps {
  repoName: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmDeleteRepo: React.FC<ConfirmDeleteRepoProps> = ({
  repoName,
  open,
  onClose,
  onConfirm,
}) => {
  const [confirmInput, setConfirmInput] = useState<string>('');

  const handleClose = () => {
    setConfirmInput('');
    onClose();
  };

  const handleConfirm = () => {
    setConfirmInput('');
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>Delete Repository</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This action cannot be undone. This will permanently delete the <strong>{repoName}</strong>{' '}
          repository.
        </DialogContentText>
        <DialogContentText style={{ marginTop: '16px', marginBottom: '8px' }}>
          Please type <strong>{repoName}</strong> to confirm:
        </DialogContentText>
        <TextField
          fullWidth
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          placeholder={repoName}
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button variant='outlined' onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant='contained'
          color='secondary'
          onClick={handleConfirm}
          disabled={confirmInput !== repoName}
        >
          Delete Repository
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteRepo;
