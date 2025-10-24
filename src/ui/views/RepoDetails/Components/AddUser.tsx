import React, { useState, useEffect } from 'react';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import CircularProgress from '@material-ui/core/CircularProgress';
import Card from '../../../components/Card/Card';
import CardBody from '../../../components/Card/CardBody';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '../../../components/CustomButtons/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import Select from '@material-ui/core/Select';
import Dialog from '@material-ui/core/Dialog';
import Snackbar from '@material-ui/core/Snackbar';
import { addUser } from '../../../services/repo';
import { getUsers } from '../../../services/user';
import { PersonAdd } from '@material-ui/icons';
import { UserData } from '../../../../types/models';
import Danger from '../../../components/Typography/Danger';

interface AddUserDialogProps {
  repoId: string;
  type: string;
  refreshFn: () => void;
  open: boolean;
  onClose: () => void;
}

const AddUserDialog: React.FC<AddUserDialogProps> = ({
  repoId,
  type,
  refreshFn,
  open,
  onClose,
}) => {
  const [username, setUsername] = useState<string>('');
  const [data, setData] = useState<UserData[]>([]);
  const [, setAuth] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [tip, setTip] = useState<boolean>(false);

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSuccess = () => {
    setTip(true);
    refreshFn();
  };

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setUsername(event.target.value as string);
  };

  const add = async () => {
    try {
      setIsLoading(true);
      await addUser(repoId, username, type);
      handleSuccess();
      handleClose();
    } catch (e) {
      setIsLoading(false);
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
  };

  useEffect(() => {
    getUsers(setIsLoading, setData, setAuth, setErrorMessage);
  }, []);

  if (errorMessage) return <Danger>{errorMessage}</Danger>;

  return (
    <>
      <Snackbar
        open={tip}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        autoHideDuration={5000}
        message='User is added successfully'
        onClose={() => setTip(false)}
      />
      <Dialog
        onClose={handleClose}
        aria-labelledby='simple-dialog-title'
        open={open}
        fullWidth
        maxWidth='md'
      >
        <DialogTitle id='simple-dialog-title'>
          Add a user...
          <p>{error}</p>
          {isLoading && <CircularProgress />}
        </DialogTitle>
        <Card>
          <CardBody>
            <GridContainer>
              <GridItem xs={12} sm={12} md={12}>
                <FormControl style={inputStyle}>
                  <InputLabel htmlFor='username'>Username</InputLabel>
                  <Select
                    labelId='demo-simple-select-helper-label'
                    id='demo-simple-select-helper'
                    value={username}
                    onChange={handleChange}
                    disabled={isLoading}
                  >
                    {data.map((row) => (
                      <MenuItem key={row.username} value={row.username}>
                        {row.username} / {row.gitAccount}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText></FormHelperText>
                </FormControl>
              </GridItem>
              <GridItem xs={12} sm={12} md={12}>
                <Button variant='outlined' color='warning' onClick={handleClose}>
                  Cancel
                </Button>
                <Button disabled={isLoading} variant='outlined' color='success' onClick={add}>
                  Add
                </Button>
              </GridItem>
            </GridContainer>
          </CardBody>
        </Card>
      </Dialog>
    </>
  );
};

interface AddUserProps {
  repoId: string;
  type: string;
  refreshFn: () => void;
}

const AddUser: React.FC<AddUserProps> = ({ repoId, type, refreshFn }) => {
  const [open, setOpen] = useState<boolean>(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Button variant='outlined' color='success' onClick={handleClickOpen}>
        <PersonAdd />
      </Button>
      <AddUserDialog
        repoId={repoId}
        type={type}
        open={open}
        onClose={handleClose}
        refreshFn={refreshFn}
      />
    </>
  );
};

export default AddUser;
