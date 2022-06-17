/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState, useEffect} from 'react';
import {Redirect} from 'react-router-dom';
import Icon from '@material-ui/core/Icon';
import GridItem from '../../components/Grid/GridItem.js';
import GridContainer from '../../components/Grid/GridContainer.js';
import Card from '../../components/Card/Card.js';
import CardIcon from '../../components/Card/CardIcon.js';
import CardBody from '../../components/Card/CardBody.js';
import CardHeader from '../../components/Card/CardHeader.js';
import Button from '../../components/CustomButtons/Button.js';
// import PropTypes from 'prop-types';
import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
// import FormControlLabel from '@material-ui/core/FormControlLabel';
// import FormControl from '@material-ui/core/FormControl';
import FormLabel from '@material-ui/core/FormLabel';
import {getUser} from '../../services/user.js';
import {makeStyles} from '@material-ui/core/styles';
import {updateUser} from '../../services/user.js';
import {getUserLoggedIn} from '../../services/user.js';

const useStyles = makeStyles((theme) => ({
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '100%',
    },
  },
}));

export default function Dashboard(props) {
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isProfile, setIsProfile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [gitAccount, setGitAccount] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react/prop-types
    const id = props.match.params.id;
    if (id == null) {
      setIsProfile(true);
    }
    if (id) {
      getUser(setIsLoading, setData, setAuth, setIsError, id);
      getUserLoggedIn(setIsLoading, setIsAdmin, setIsError);
    } else {
      console.log('getting user data');
      setIsProfile(true);
      getUser(setIsLoading, setData, setAuth, setIsError);
    }
  }, [props]);


  if (isLoading) return (<div>Loading ...</div>);
  if (isError) return (<div>Something went wrong ...</div>);
  if (!auth) return (<Redirect to={{pathname: '/login'}} />);

  console.log(data);

  const updateProfile = async () => {
    try {
      console.log('GitAccount' + gitAccount);
      data.gitAccount = gitAccount;
      await updateUser(data);
    } catch (e) {}
  };

  const UpdateButton = () => (
    <Button variant="outlined" color="primary" onClick={updateProfile}>Update</Button>
  );

  return (
    <form className={classes.root} noValidate autoComplete="off">
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <Card>
            <CardHeader color="success" stats icon>
              <CardIcon color="success">
                <Icon>content_copy</Icon>
                <h3>User Details</h3>
              </CardIcon>
            </CardHeader>
            <br />
            <br />
            <CardBody>
              <GridContainer>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField
                    id="username"
                    label="Username"
                    aria-describedby="username-helper-text"
                    InputProps={{
                      readOnly: true,
                    }}
                    variant="outlined"
                    value={data.displayName==null ? data.username: data.displayName} />
                </GridItem>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField
                    id="gitAccount"
                    label="Git Account"
                    aria-describedby="gitAccount-helper-text"
                    variant="outlined"
                    value={data.gitAccount}
                    onChange={(e) => setGitAccount(e.target.value)} />
                </GridItem>
                <GridItem xs={4} sm={4} md={4}>
                  <FormLabel component="legend">Admin</FormLabel>
                  <Checkbox
                    id="admin"
                    variant="outlined"
                    checked={data.admin}/>
                </GridItem>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField
                    id="email"
                    label="Email Address"
                    aria-describedby="email-helper-text"
                    variant="outlined"
                    value={data.id == null ? data.email : data.id} />
                </GridItem>
                <GridItem xs={12} sm={12} md={12}>
                { isProfile || isAdmin ? <UpdateButton /> : null }
                </GridItem>
              </GridContainer>
            </CardBody>
          </Card>
        </GridItem>
      </GridContainer>
    </form>
  );
}
