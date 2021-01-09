/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState} from 'react';
import PropTypes from 'prop-types';
import Icon from '@material-ui/core/Icon';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import Checkbox from '@material-ui/core/Checkbox';
import FormHelperText from '@material-ui/core/FormHelperText';
import GridItem from '../../components/Grid/GridItem.js';
import GridContainer from '../../components/Grid/GridContainer.js';
import FormControl from '@material-ui/core/FormControl';
import Card from '../../components/Card/Card.js';
import CardIcon from '../../components/Card/CardIcon.js';
import CardBody from '../../components/Card/CardBody.js';
import CardHeader from '../../components/Card/CardHeader.js';
import Button from '../../components/CustomButtons/Button.js';
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';

import {createUser} from '../../services/user.js';

function CreateUserDialog(props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState('');
  const {onClose, open} = props;

  const handleClose = () => {
    onClose();
  };

  const create = async () => {
    const data = {
      username: username,
      email: email,
      admin: admin,
    };

    try {
      await createUser(data);
      handleClose();
    } catch (e) {
      if (e.message) {
        setError(e.response.data.message);
      } else {
        setError(e.toString());
      }
    }
  };

  return (
    <Dialog onClose={handleClose} aria-labelledby="simple-dialog-title" open={open}>
      <DialogTitle style={{'color': 'red'}} id="simple-dialog-title">{error}</DialogTitle>
      <Card>
        <CardBody>
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl>
                <InputLabel htmlFor="username">Username</InputLabel>
                <Input
                  id="username"
                  aria-describedby="my-helper-text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)} />
                <FormHelperText id="my-helper-text">The username</FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl>
                <InputLabel htmlFor="email">Email address</InputLabel>
                <Input
                  id="email"
                  aria-describedby="my-helper-text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)} />
                <FormHelperText id="my-helper-text">The users email - an email will be sent to the user with at temporary password</FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl>
                <InputLabel htmlFor="email">Is an Admin</InputLabel>
                <Checkbox
                  id="email"
                  aria-describedby="my-helper-text"
                  value={admin}
                  onChange={(e) => setAdmin(e.target.value)} />
                <FormHelperText id="my-helper-text">Admin users are able to add repositories and create users</FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <Button variant="outlined" color="primary" onClick={handleClose}>Cancel</Button>
              <Button variant="outlined" color="primary" onClick={create}>Create</Button>

            </GridItem>
          </GridContainer>
        </CardBody>
      </Card>
    </Dialog>
  );
}

CreateUserDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};

export default function Dashboard(props) {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardHeader color="success" stats icon>
            <CardIcon color="success">
              <Icon>content_copy</Icon>
              <h3>Admin</h3>
            </CardIcon>
          </CardHeader>
          <CardBody>
            <GridContainer>
              <GridItem xs={2} sm={2} md={2}>
                <Button variant="outlined" color="primary" onClick={handleClickOpen}>Create New User</Button>
                <CreateUserDialog open={open} onClose={handleClose} />
              </GridItem>
            </GridContainer>
          </CardBody>
        </Card>
      </GridItem>
    </GridContainer>
  );
}
