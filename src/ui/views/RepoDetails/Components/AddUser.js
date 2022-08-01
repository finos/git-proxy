/* eslint-disable react/prop-types */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import GridItem from '../../../components/Grid/GridItem.js';
import GridContainer from '../../../components/Grid/GridContainer.js';
import CircularProgress from '@material-ui/core/CircularProgress';
import Card from '../../../components/Card/Card.js';
import CardBody from '../../../components/Card/CardBody.js';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '../../../components/CustomButtons/Button.js';
import DialogTitle from '@material-ui/core/DialogTitle';
import Select from '@material-ui/core/Select';
import Dialog from '@material-ui/core/Dialog';
import Snackbar from '@material-ui/core/Snackbar';
import {Redirect} from 'react-router-dom';
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
  const [tip, setTip] = useState(false);
  const {onClose, open} = props;

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSuccess = (data)=>{
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
      handleSuccess(true);
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


  if (isError) return (<div>Something went wrong ...</div>);
  if (!auth) return (<Redirect to={{pathname: '/login'}} />);

  let spinner;
  if (isLoading) {
    spinner = <CircularProgress />;
  }

  return (<>
    <Snackbar open={tip} anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }} autoHideDuration={5000} message="User is added successfully" onClose={()=>setTip(false)}/>
    <Dialog onClose={handleClose} aria-labelledby="simple-dialog-title" open={open}>
      <DialogTitle style={{'color': 'green'}} id="simple-dialog-title">Add User<p>{error}</p> {spinner}</DialogTitle>
      <Card>
        <CardBody>
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl style={inputStyle}>
                <InputLabel htmlFor="username">Username</InputLabel>
                <Select
                  labelId="demo-simple-select-helper-label"
                  id="demo-simple-select-helper"
                  value={username}
                  onChange={handleChange}
                  disabled={isLoading}>
                  {data.map((row) => (
                    <MenuItem key={row.username} value={row.username}>{row.username} / {row.gitAccount}</MenuItem>
                  ))}
                </Select>
                <FormHelperText></FormHelperText>
              </FormControl>
            </GridItem>
            <GridItem xs={12} sm={12} md={12}>
              <Button variant="outlined" color="warning" onClick={handleClose}>Cancel</Button>
              <Button disabled={isLoading} variant="outlined" color="primary" onClick={add}>Add</Button>
            </GridItem>
          </GridContainer>
        </CardBody>
      </Card>
    </Dialog></>
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

  return (<>
      <Button variant="outlined" color="primary" onClick={handleClickOpen}>Add User</Button>
      <AddUserDialog repoName={repoName} type={type} open={open} onClose={handleClose} refreshFn={refreshFn} />
      </>
  );
}
