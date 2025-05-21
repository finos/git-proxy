/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
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
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
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

function AddUserDialog(props) {
  const repoName = props.repoName;
  const type = props.type;
  const refreshFn = props.refreshFn;
  const [username, setUsername] = useState('');
  const [data, setData] = useState([]);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState('');
  const [tip, setTip] = useState(false);
  const { onClose, open } = props;

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSuccess = () => {
    setTip(true);
    refreshFn();
  };

  const handleChange = (event) => {
    setUsername(event.target.value);
  };

  const add = async () => {
    try {
      setIsLoading(true);
      await addUser(repoName, username, type);
      handleSuccess();
      handleClose();
    } catch (e) {
      setIsLoading(false);
      if (e.message) {
        setError(JSON.stringify(e));
      } else {
        setError(e.toString());
      }
    }
  };

  const inputStyle = {
    width: '100%',
  };

  useEffect(() => {
    getUsers(setIsLoading, setData, setAuth, setIsError, {});
  }, [props]);

  if (isError) return <div>Something went wrong ...</div>;

  let spinner;
  if (isLoading) {
    spinner = <CircularProgress />;
  }

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
          Add a user...<p>{error}</p> {spinner}
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
    <>
      <Button variant='outlined' color='success' onClick={handleClickOpen}>
        <PersonAdd></PersonAdd>
      </Button>
      <AddUserDialog
        repoName={repoName}
        type={type}
        open={open}
        onClose={handleClose}
        refreshFn={refreshFn}
      />
    </>
  );
}
