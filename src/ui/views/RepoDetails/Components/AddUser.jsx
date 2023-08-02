/* eslint-disable react/prop-types */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import GridItem from '../../../components/Grid/GridItem.jsx';
import GridContainer from '../../../components/Grid/GridContainer.jsx';
import Card from '../../../components/Card/Card.jsx';
import CardBody from '../../../components/Card/CardBody.jsx';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '../../../components/CustomButtons/Button.jsx';
import DialogTitle from '@material-ui/core/DialogTitle';
import Select from '@material-ui/core/Select';
import Dialog from '@material-ui/core/Dialog';
import {Navigate} from 'react-router-dom';

import {addUser} from '../../../services/repo.js';
import {getUsers} from '../../../services/user.js';

function AddUserDialog(props) {
  const repoName = props.repoName;
  const type = props.type;
  const refreshFn = props.refreshFn;
  const [username, setUsername] = useState('');
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState('');
  const {onClose, open} = props;

  const handleClose = () => {
    refreshFn();
    onClose();
  };

  const handleChange = (event) => {
    setUsername(event.target.value);
  };

  const add = async () => {
    try {
      await addUser(repoName, username, type);
      handleClose();
    } catch (e) {
      if (e.message) {
        setError(JSON.stringify(e));
      } else {
        setError(e.toString());
      }
    }
  };

  useEffect(() => {
    getUsers(setIsLoading, setData, setAuth, setIsError, {});
  }, [props]);

  if (isLoading) return (<div>Loading ...</div>);
  if (isError) return (<div>Something went wrong ...</div>);
  if (!auth) return (<Navigate to={{pathname: '/login'}} />);

  console.log(JSON.stringify(props));

  return (
    <Dialog onClose={handleClose} aria-labelledby="simple-dialog-title" open={open}>
      <DialogTitle style={{'color': 'red'}} id="simple-dialog-title">{error} Add User to {repoName} for {type} </DialogTitle>
      <Card>
        <CardBody>
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl>
                <InputLabel htmlFor="username">Username</InputLabel>
                <Select
                  labelId="demo-simple-select-helper-label"
                  id="demo-simple-select-helper"
                  value={username}
                  onChange={handleChange}
                >
                  {data.map((row) => (
                    <MenuItem key={row.username} value={row.username}>{row.username} / {row.gitAccount}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>Some important helper text</FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <Button variant="outlined" color="primary" onClick={handleClose}>Cancel</Button>
              <Button variant="outlined" color="primary" onClick={add}>Create</Button>
            </GridItem>
          </GridContainer>
        </CardBody>
      </Card>
    </Dialog>
  );
}

AddUserDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  refreshFn: PropTypes.func.isRequired,
};

export default function AddUser(props) {
  const [open, setOpen] = React.useState(false);

  const repoName = props.repoName;
  const type = props.type;
  const refreshFn = props.refreshFn;

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div>
      <Button variant="outlined" color="primary" onClick={handleClickOpen}>Add User</Button>
      <AddUserDialog repoName={repoName} type={type} open={open} onClose={handleClose} refreshFn={refreshFn} />
    </div>
  );
}
