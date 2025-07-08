import React, { useState, useEffect } from 'react';
import {
  TextField,
  IconButton,
  InputAdornment,
  FormLabel,
  Typography,
} from '@material-ui/core';
import { Visibility, VisibilityOff, Save, Clear } from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';

import GridContainer from '../../components/Grid/GridContainer';
import GridItem from '../../components/Grid/GridItem';
import Card from '../../components/Card/Card';
import CardBody from '../../components/Card/CardBody';
import Button from '../../components/CustomButtons/Button';

const useStyles = makeStyles((theme) => ({
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '100%',
    },
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: theme.spacing(2),
    gap: theme.spacing(1),
  },
}));

export default function SettingsView() {
  const classes = useStyles();

  const [jwtToken, setJwtToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('ui_jwt_token');
    if (savedToken) setJwtToken(savedToken);
  }, []);

  const handleSave = () => {
    localStorage.setItem('ui_jwt_token', jwtToken);
  };

  const handleClear = () => {
    setJwtToken('');
    localStorage.removeItem('ui_jwt_token');
  };

  const toggleShowToken = () => {
    setShowToken(!showToken);
  };

  return (
    <form className={classes.root} noValidate autoComplete='off'>
      <GridContainer justify='center'>
        <GridItem xs={12} sm={12} md={6}>
          <Card>
            <CardBody>
              {/* Title */}
              <FormLabel component='legend' style={{ fontSize: '1.2rem' }}>JWT Token for UI Authentication</FormLabel>
              <Typography variant='body2'>
                The JWT token used to authenticate UI requests to the server when the "apiAuthentication" is enabled in the config.
              </Typography>
              <TextField
                id='jwt-token'
                type={showToken ? 'text' : 'password'}
                variant='outlined'
                placeholder='Enter your JWT token...'
                value={jwtToken}
                onChange={(e) => setJwtToken(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton onClick={toggleShowToken} edge='end'>
                        {showToken ? <Visibility /> : <VisibilityOff />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  style: {
                    marginTop: '10px',
                    marginLeft: '-8px',
                    marginRight: '8px',
                  },
                }}
              />
              <div className={classes.buttonRow}>
                <Button color='default' onClick={handleClear}>
                  <Clear style={{ marginRight: '5px' }} />
                  Clear
                </Button>
                <Button color='success' onClick={handleSave}>
                  <Save style={{ marginRight: '5px' }} />
                  Save
                </Button>
              </div>
            </CardBody>
          </Card>
        </GridItem>
      </GridContainer>
    </form>
  );
}
