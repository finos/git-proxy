import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Typography, Button, IconButton, Grid, Paper, Modal, TextField } from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import axios from 'axios';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
    minHeight: 'auto',
    width: '100%',
    boxSizing: 'border-box',
    margin: '0 auto',
  },
  button: {
    marginBottom: theme.spacing(2),
    backgroundColor: '#4caf50',
    color: 'white',
    '&:hover': {
      backgroundColor: '#388e3c',
    },
  },
  deleteButton: {
    color: '#ff4444',
  },
  keyContainer: {
    padding: theme.spacing(2),
    borderRadius: '8px',
    marginBottom: theme.spacing(2),
    width: '100%',
  },
  modal: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: theme.spacing(4),
    borderRadius: '8px',
    width: '400px',
    boxShadow: theme.shadows[5],
  },
  formField: {
    marginBottom: theme.spacing(2),
  },
}));

export default function SSHKeysManager({ username }) {
  const classes = useStyles();
  const [keys, setKeys] = useState([
    {
      name: 'macOS',
      hash: 'SHA256:+s1qm8b66N1BQtVMWFeeTJb+QsJiJzxaswyO0lJ7kNw',
    },
    {
      name: 'dev',
      hash: 'SHA256:RHNzb7j+QyoE/xrCZCc0IiQ8+XdAF8tEno/tZ1rzqF0',
    },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  const handleDelete = async (index) => {
    const keyToRemove = keys[index].hash;
    try {
      await axios.delete(`/api/${username}/ssh-keys`, {
        data: { publicKey: keyToRemove },
      });
      setKeys(keys.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Failed to remove SSH key:', error);
    }
  };

  const handleAddKey = async () => {
    if (newKeyName.trim() && newKeyValue.trim()) {
      try {
        await axios.post(`/api/${username}/ssh-keys`, {
          publicKey: newKeyValue.trim(),
        });
        setKeys([
          ...keys,
          {
            name: newKeyName.trim(),
            hash: newKeyValue.trim(),
          },
        ]);
        setNewKeyName('');
        setNewKeyValue('');
        setIsModalOpen(false);
      } catch (error) {
        console.error('Failed to add SSH key:', error);
      }
    }
  };

  return (
    <div className={classes.root}>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant='h4' gutterBottom>
            SSH Keys
          </Typography>
          <Typography variant='body1' color='textSecondary' paragraph>
            This is the list of SSH keys currently associated with your account.
          </Typography>
          <Button
            variant='contained'
            className={classes.button}
            onClick={() => setIsModalOpen(true)}
          >
            New SSH Key
          </Button>
          <div className={classes.keyList}>
            {keys.map((key, index) => (
              <Paper key={index} className={classes.keyContainer} elevation={3}>
                <Grid container alignItems='center' justifyContent='space-between'>
                  <Grid item>
                    <Grid container alignItems='center' spacing={1}>
                      <Grid item>
                        <VpnKeyIcon color='primary' />
                      </Grid>
                      <Grid item>
                        <Typography variant='h6'>{key.name}</Typography>
                      </Grid>
                    </Grid>
                    <Typography variant='body2' color='textSecondary'>
                      {key.hash}
                    </Typography>
                  </Grid>
                  <Grid item>
                    <IconButton
                      className={classes.deleteButton}
                      onClick={() => handleDelete(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </div>
        </Grid>
      </Grid>

      {/* Modal for adding a new SSH key */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} className={classes.modal}>
        <div className={classes.modalContent}>
          <Typography variant='h6' gutterBottom>
            Add New SSH Key
          </Typography>
          <TextField
            label='Key Title'
            variant='outlined'
            fullWidth
            className={classes.formField}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <TextField
            label='Key Value'
            variant='outlined'
            fullWidth
            multiline
            rows={4}
            className={classes.formField}
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
          />
          <Button variant='contained' color='primary' fullWidth onClick={handleAddKey}>
            Add Key
          </Button>
        </div>
      </Modal>
    </div>
  );
}
