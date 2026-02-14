/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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

const DeleteRepoDialog: React.FC<ConfirmDeleteRepoProps> = ({
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

export default DeleteRepoDialog;
