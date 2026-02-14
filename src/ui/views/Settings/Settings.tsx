/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
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

import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  TextField,
  IconButton,
  InputAdornment,
  FormLabel,
  Snackbar,
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

const SettingsView: React.FC = () => {
  const classes = useStyles();

  const [jwtToken, setJwtToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('ui_jwt_token');
    if (savedToken) setJwtToken(savedToken);
  }, []);

  const handleSave = (): void => {
    localStorage.setItem('ui_jwt_token', jwtToken);
    setSnackbarMessage('JWT token saved');
    setSnackbarOpen(true);
  };

  const handleClear = (): void => {
    setJwtToken('');
    localStorage.removeItem('ui_jwt_token');
    setSnackbarMessage('JWT token cleared');
    setSnackbarOpen(true);
  };

  const toggleShowToken = (): void => {
    setShowToken(!showToken);
  };

  return (
    <form className={classes.root} noValidate autoComplete='off'>
      <GridContainer justify='center'>
        <GridItem xs={12} sm={12} lg={6}>
          <Card>
            <CardBody>
              {/* Title */}
              <FormLabel component='legend' style={{ fontSize: '1.2rem' }}>
                JWT Token for UI Authentication
              </FormLabel>
              <Typography variant='body2'>
                Authenticates UI requests to the server when &quot;apiAuthentication&quot; is
                enabled in the config.
              </Typography>
              <TextField
                id='jwt-token'
                type={showToken ? 'text' : 'password'}
                variant='outlined'
                placeholder='Enter your JWT token...'
                value={jwtToken}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setJwtToken(e.target.value)}
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
                <Button onClick={handleClear}>
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
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </form>
  );
};

export default SettingsView;
