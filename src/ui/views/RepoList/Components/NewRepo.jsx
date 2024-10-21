import React, { useState } from 'react';
import PropTypes from 'prop-types';
import InputLabel from '@mui/material/InputLabel';
import Input from '@mui/material/Input';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import Card from '../../../components/Card/Card';
import CardBody from '../../../components/Card/CardBody';
import Button from '../../../components/CustomButtons/Button';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import Snackbar from '@mui/material/Snackbar';
import { addRepo } from '../../../services/repo';
import makeStyles from '@mui/styles/makeStyles';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle';
import { RepoIcon } from '@primer/octicons-react';

const useStyles = makeStyles(styles);

function AddRepositoryDialog(props) {
  const [project, setProject] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [tip, setTip] = useState(false);
  const { onClose, open, onSuccess } = props;
  const classes = useStyles();

  const handleClose = () => {
    setError('');
    resetRepo();
    onClose();
  };

  const handleSuccess = (data) => {
    onSuccess(data);
    setTip(true);
  };

  const resetRepo = () => {
    setProject('');
    setName('');
    setUrl('');
  };

  const add = async () => {
    const data = {
      project: project,
      name: name,
      url: url,
      maxUser: 1,
    };

    if (data.project.trim().length == 0 || data.project.length > 100) {
      setError('project name length unexpected');
      return;
    }

    if (data.name.trim().length == 0 || data.name.length > 100) {
      setError('Repo name length unexpected');
      return;
    }

    try {
      new URL(data.url);
    } catch (e) {
      setError('Invalid URL');
      return;
    }

    try {
      await addRepo(onClose, setError, data);
      handleSuccess(data);
      handleClose();
    } catch (e) {
      if (e.message) {
        setError(e.message);
      } else {
        setError(e.toString());
      }
    }
  };

  const inputStyle = {
    width: '100%',
  };

  return (
    <>
      <Snackbar
        open={tip}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        autoHideDuration={5000}
        message={`New repository created \u{1F44D}`}
        onClose={() => setTip(false)}
      />
      <Dialog
        onClose={handleClose}
        aria-labelledby='simple-dialog-title'
        open={open}
        fullWidth
        maxWidth='md'
      >
        <DialogTitle style={{ color: 'red' }} id='simple-dialog-title'>
          {error}
        </DialogTitle>
        <DialogTitle style={{ textAlign: 'left' }} className={classes.cardTitle}>
          Add a repository...
        </DialogTitle>
        <Card>
          <CardBody>
            <GridContainer>
              <GridItem xs={12} sm={12} md={12}>
                <FormControl style={inputStyle}>
                  <InputLabel htmlFor='project'>Organization</InputLabel>
                  <Input
                    id='project'
                    inputProps={{ maxLength: 200, minLength: 3 }}
                    aria-describedby='project-helper-text'
                    onChange={(e) => setProject(e.target.value)}
                  />
                  <FormHelperText id='project-helper-text'>GitHub Organization</FormHelperText>
                </FormControl>
              </GridItem>
              <GridItem xs={12} sm={12} md={12}>
                <FormControl style={inputStyle}>
                  <InputLabel htmlFor='name'>Name</InputLabel>
                  <Input
                    inputProps={{ maxLength: 200, minLength: 3 }}
                    id='name'
                    aria-describedby='name-helper-text'
                    onChange={(e) => setName(e.target.value)}
                  />
                  <FormHelperText id='name-helper-text'>GitHub Repository Name</FormHelperText>
                </FormControl>
              </GridItem>
              <GridItem xs={12} sm={12} md={12}>
                <FormControl style={inputStyle}>
                  <InputLabel htmlFor='url'>URL</InputLabel>
                  <Input
                    inputProps={{ maxLength: 200, type: 'url' }}
                    type='url'
                    id='url'
                    aria-describedby='url-helper-text'
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <FormHelperText id='url-helper-text'>GitHub Repository URL</FormHelperText>
                </FormControl>
              </GridItem>
              <GridItem xs={12} sm={12} md={12}>
                <div style={{ textAlign: 'right' }}>
                  <Button variant='outlined' color='warning' onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button variant='outlined' color='success' onClick={add}>
                    Add
                  </Button>
                </div>
              </GridItem>
            </GridContainer>
          </CardBody>
        </Card>
      </Dialog>
    </>
  );
}

AddRepositoryDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

NewRepo.propTypes = {
  onSuccess: PropTypes.func.isRequired,
};

export default function NewRepo(props) {
  const [open, setOpen] = React.useState(false);
  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div>
      <Button color='success' onClick={handleClickOpen}>
        <RepoIcon></RepoIcon>Add repository
      </Button>
      <AddRepositoryDialog open={open} onClose={handleClose} onSuccess={props.onSuccess} />
    </div>
  );
}
