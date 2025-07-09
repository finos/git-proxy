import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  IconButton,
  Grid,
  Paper,
  Modal,
  TextField,
  Snackbar,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import axios from 'axios';

const useStyles = makeStyles((theme) => ({
  root: { padding: theme.spacing(3), width: '100%' },
  button: {
    marginBottom: theme.spacing(2),
    backgroundColor: '#4caf50',
    color: 'white',
    '&:hover': { backgroundColor: '#388e3c' },
  },
  keyContainer: { padding: theme.spacing(2), marginBottom: theme.spacing(2) },
  deleteButton: { color: '#ff4444' },
  modal: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalContent: {
    backgroundColor: 'white',
    padding: theme.spacing(4),
    borderRadius: 8,
    width: 400,
  },
  formField: { marginBottom: theme.spacing(2) },
}));

const API_BASE = `${import.meta.env.VITE_API_URI}/api/v1/user`;

export default function SSHKeysManager({ username }) {
  const classes = useStyles();

  const [keys, setKeys] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');

  const [banner, setBanner] = useState(null);

  /* -----------------------------------------------------------
   * Helper: fetch fingerprints from backend
   * --------------------------------------------------------- */
  const loadKeys = useCallback(async () => {
    if (!username) return;
    try {
      const res = await axios.get(`${API_BASE}/${username}/ssh-keys`, {
        withCredentials: true,
      });

      const fingerprints = res.data.publicKeys || [];
      setKeys(
        fingerprints.map((hash, i) => ({
          name: `key${i + 1}`,
          hash,
        })),
      );
    } catch (err) {
      console.error('Could not fetch SSH keys:', err);
      setBanner({ type: 'error', text: 'Failed to load SSH keys' });
    }
  }, [username]);

  /* Load keys on mount / username change */
  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  /* -----------------------------------------------------------
   * Delete by fingerprint
   * --------------------------------------------------------- */
  const handleDelete = async (index) => {
    const { hash: fingerprint } = keys[index];
    try {
      await axios.delete(`${API_BASE}/${username}/ssh-keys/fingerprint`, {
        data: { fingerprint },
        withCredentials: true,
      });
      await loadKeys();
      setBanner({ type: 'success', text: 'SSH key removed' });
    } catch (err) {
      console.error('Failed to remove SSH key:', err);
      setBanner({
        type: 'error',
        text: err.response?.data?.error || 'Failed to remove SSH key',
      });
    }
  };

  /* -----------------------------------------------------------
   * Add new public key, then refresh list
   * --------------------------------------------------------- */
  const handleAddKey = async () => {
    const trimmed = newKeyValue.trim();
    if (!trimmed) return;

    try {
      await axios.post(
        `${API_BASE}/${username}/ssh-keys`,
        { publicKey: trimmed },
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      await loadKeys();
      setBanner({ type: 'success', text: 'SSH key added' });
      setNewKeyValue('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to add SSH key:', err);
      setBanner({
        type: 'error',
        text: err.response?.data?.error || 'Failed to add SSH key',
      });
    }
  };

  return (
    <div className={classes.root}>
      {/* -------- Snackbar banner -------- */}
      <Snackbar
        open={Boolean(banner)}
        autoHideDuration={4000}
        onClose={() => setBanner(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {banner && (
          <Alert
            onClose={() => setBanner(null)}
            severity={banner.type === 'success' ? 'success' : 'error'}
            variant='filled'
          >
            {banner.text}
          </Alert>
        )}
      </Snackbar>

      <Typography variant='h4' gutterBottom>
        SSH Keys
      </Typography>
      <Typography variant='body1' color='textSecondary' paragraph>
        These are the SSH keys linked to your account.
      </Typography>

      <Button variant='contained' className={classes.button} onClick={() => setIsModalOpen(true)}>
        Add new SSH Key
      </Button>

      {keys.map((key, idx) => (
        <Paper key={idx} className={classes.keyContainer} elevation={3}>
          <Grid container alignItems='center' spacing={1} style={{ marginBottom: 8 }}>
            <Grid item>
              <VpnKeyIcon color='primary' />
            </Grid>
            <Grid item>
              <Typography variant='h6'>{key.name}</Typography>
            </Grid>
          </Grid>

          <Grid container alignItems='center' justifyContent='space-between'>
            <Grid item xs>
              <Typography variant='body2' color='textSecondary'>
                {key.hash}
              </Typography>
            </Grid>
            <Grid item>
              <IconButton className={classes.deleteButton} onClick={() => handleDelete(idx)}>
                <DeleteIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Paper>
      ))}

      {/* Modal for new key input */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} className={classes.modal}>
        <div className={classes.modalContent}>
          <Typography variant='h6' gutterBottom>
            Add a new SSH key
          </Typography>

          <TextField
            label='Public key'
            variant='outlined'
            fullWidth
            multiline
            rows={4}
            className={classes.formField}
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            placeholder='ssh-ed25519 AAAAC3Nz... user@example'
          />

          <Button variant='contained' color='primary' fullWidth onClick={handleAddKey}>
            Add Key
          </Button>
        </div>
      </Modal>
    </div>
  );
}
