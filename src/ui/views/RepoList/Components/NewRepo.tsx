import React, { useState } from 'react';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import Card from '../../../components/Card/Card';
import CardBody from '../../../components/Card/CardBody';
import Button from '../../../components/CustomButtons/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import Snackbar from '@material-ui/core/Snackbar';
import { addRepo } from '../../../services/repo';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle';
import { RepoIcon } from '@primer/octicons-react';

interface AddRepositoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: RepositoryData) => void;
}

export interface RepositoryData {
  _id?: string;
  project: string;
  name: string;
  url: string;
  maxUser: number;
  lastModified?: string;
  dateCreated?: string;
  proxyURL?: string;
}

interface NewRepoProps {
  onSuccess: (data: RepositoryData) => void;
}

const useStyles = makeStyles(styles as any);

const AddRepositoryDialog: React.FC<AddRepositoryDialogProps> = ({ open, onClose, onSuccess }) => {
  const [project, setProject] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [tip, setTip] = useState(false);
  const classes = useStyles();

  const handleClose = () => {
    setError('');
    resetRepo();
    onClose();
  };

  const handleSuccess = (data: RepositoryData) => {
    onSuccess(data);
    setTip(true);
  };

  const resetRepo = () => {
    setProject('');
    setName('');
    setUrl('');
  };

  const add = async () => {
    const data: RepositoryData = {
      project: project.trim(),
      name: name.trim(),
      url: url.trim(),
      maxUser: 1,
    };

    if (data.project.length === 0 || data.project.length > 100) {
      setError('Project name length must be between 1 and 100 characters');
      return;
    }

    if (data.name.length === 0 || data.name.length > 100) {
      setError('Repository name length must be between 1 and 100 characters');
      return;
    }

    try {
      new URL(data.url);
    } catch {
      setError('Invalid URL format');
      return;
    }

    try {
      await addRepo(onClose, setError, data);
      handleSuccess(data);
      handleClose();
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  const inputStyle: React.CSSProperties = {
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
        {error && (
          <DialogTitle style={{ color: 'red' }} id='simple-dialog-title'>
            {error}
          </DialogTitle>
        )}
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
                    value={project}
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
                    value={name}
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
                    value={url}
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
};

const NewRepo: React.FC<NewRepoProps> = ({ onSuccess }) => {
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div>
      <Button color='success' onClick={handleClickOpen}>
        <RepoIcon /> Add repository
      </Button>
      <AddRepositoryDialog open={open} onClose={handleClose} onSuccess={onSuccess} />
    </div>
  );
};

export default NewRepo;
