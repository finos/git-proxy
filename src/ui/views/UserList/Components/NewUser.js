/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState} from 'react';
import PropTypes from 'prop-types';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import FormControl from '@material-ui/core/FormControl';
import Checkbox from '@material-ui/core/Checkbox';
import FormHelperText from '@material-ui/core/FormHelperText';
import GridItem from '../../../components/Grid/GridItem.js';
import GridContainer from '../../../components/Grid/GridContainer.js';
import Card from '../../../components/Card/Card.js';
import CardBody from '../../../components/Card/CardBody.js';
import Button from '../../../components/CustomButtons/Button.js';
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import Snackbar from '@material-ui/core/Snackbar';

import {createUser} from '../../../services/user.js';

function CreateUserDialog(props) {
  const [username, setUsername] = useState('');
  const [tip, setTip] = useState(false);
  const [email, setEmail] = useState('');
  const [gitAccount, setGitAccount] = useState('');
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState('');
  const {onClose, open, onSuccess} = props;
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleClose = () => {
    setError('');
    resetUser();
    setIsModalVisible(false);
    onClose();
  };

  const handleSuccess = (data)=>{
    onSuccess(data);
    setTip(true);
  };

  const resetUser = ()=>{
    console.log('resetUser');
    setUsername('');
    setEmail('');
    setGitAccount('');
    setAdmin(false);
  };

  const handleChange = (event) => {
    setAdmin(event.target.checked);
  };

  const create = async () => {
    const data = {
      username: username?username:setIsModalVisible(true),
      gitAccount: gitAccount?gitAccount:setIsModalVisible(true),
      email: email?email:setIsModalVisible(true),
      admin: admin,
    };

    try {
      await createUser(data);
      handleSuccess(data);
      handleClose();
    } catch (e) {
      if (e.message) {
        setError(e.response.data.message);
      } else {
        setError(e.toString());
      }
    }
  };

  return (<>
    <Snackbar open={tip} anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }} autoHideDuration={5000} message="User is added successfully" onClose={()=>setTip(false)}/>
    <Dialog onClose={handleClose} aria-labelledby="simple-dialog-title" visible={`${isModalVisible}`} open={open}>
      <DialogTitle style={{'color': 'red'}} id="simple-dialog-title">{error}</DialogTitle>
      <Card>
        <CardBody>
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl>
                <InputLabel htmlFor="username">Username</InputLabel>
                <Input
                  id="username"
                  aria-describedby="username-helper-text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)} />
                <FormHelperText id="username-helper-text">The username</FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl>
                <InputLabel htmlFor="email">Email address</InputLabel>
                <Input
                  id="email"
                  aria-describedby="email-helper-text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)} />
                <FormHelperText id="email-helper-text">The users email - an email will be sent to the user with at temporary password</FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl>
                <InputLabel htmlFor="gitAccount">GitAccount Name</InputLabel>
                <Input
                  id="gitAccount"
                  aria-describedby="gitAccount-helper-text"
                  value={gitAccount}
                  onChange={(e) => setGitAccount(e.target.value)} />
                <FormHelperText id="gitAccounty-helper-text">The users Git Account user name</FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl>
                <InputLabel htmlFor="email">Is an Admin</InputLabel>
                <Checkbox
                  id="email"
                  aria-describedby="email-helper-text"
                  checked={admin}
                  onChange={handleChange} />
                <FormHelperText id="email-helper-text">Admin users are able to add repositories and create users</FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <Button variant="outlined" color="primary" onClick={handleClose}>Cancel</Button>
              <Button variant="outlined" color="primary" onClick={create}>Create</Button>
            </GridItem>
          </GridContainer>
        </CardBody>
      </Card>
    </Dialog></>
  );
}

CreateUserDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

NewUser.propTypes = {
  onSuccess: PropTypes.func.isRequired,
};

export default function NewUser(props) {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div>
      <Button variant="outlined" color="primary" onClick={handleClickOpen}>Create New User</Button>
      <CreateUserDialog open={open} onClose={handleClose} onSuccess={props.onSuccess}/>
    </div>
  );
}
