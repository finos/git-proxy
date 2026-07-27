/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { CircularProgress, FormLabel } from '@material-ui/core';
import FormControl from '@material-ui/core/FormControl';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';

import Button from '../../../components/CustomButtons/Button';
import CardBody from '../../../components/Card/CardBody';
import CardFooter from '../../../components/Card/CardFooter';
import GridContainer from '../../../components/Grid/GridContainer';
import GridItem from '../../../components/Grid/GridItem';

type AuthFormSectionProps = {
  requirePasswordChange: boolean;
  isLoading: boolean;
  usernamePasswordMethod: string;
  authMethods: string[];
  username: string;
  password: string;
  currentPasswordForChange: string;
  newPassword: string;
  confirmNewPassword: string;
  canSubmitLogin: boolean;
  canSubmitPasswordChange: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onCurrentPasswordForChangeChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmNewPasswordChange: (value: string) => void;
  onAuthMethodLogin: (authMethod: string) => void;
};

const AuthFormSection: React.FC<AuthFormSectionProps> = ({
  requirePasswordChange,
  isLoading,
  usernamePasswordMethod,
  authMethods,
  username,
  password,
  currentPasswordForChange,
  newPassword,
  confirmNewPassword,
  canSubmitLogin,
  canSubmitPasswordChange,
  onUsernameChange,
  onPasswordChange,
  onCurrentPasswordForChangeChange,
  onNewPasswordChange,
  onConfirmNewPasswordChange,
  onAuthMethodLogin,
}) => {
  return (
    <>
      {requirePasswordChange ? (
        <CardBody>
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <FormLabel component='legend' style={{ fontSize: '1.2rem', marginTop: 10 }}>
                Password change required
              </FormLabel>
              <FormLabel
                component='legend'
                style={{ fontSize: '0.95rem', marginTop: 10, opacity: 0.8 }}
              >
                This account is using an insecure default password. Update it now to continue.
              </FormLabel>
              <FormControl fullWidth>
                <InputLabel htmlFor='current-password'>Current password</InputLabel>
                <Input
                  id='current-password'
                  type='password'
                  value={currentPasswordForChange}
                  onChange={(e) => onCurrentPasswordForChangeChange(e.target.value)}
                  data-test='current-password'
                />
              </FormControl>
              <FormControl fullWidth>
                <InputLabel htmlFor='new-password'>New password</InputLabel>
                <Input
                  id='new-password'
                  type='password'
                  value={newPassword}
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  data-test='new-password'
                />
              </FormControl>
              <FormControl fullWidth>
                <InputLabel htmlFor='confirm-new-password'>Confirm new password</InputLabel>
                <Input
                  id='confirm-new-password'
                  type='password'
                  value={confirmNewPassword}
                  onChange={(e) => onConfirmNewPasswordChange(e.target.value)}
                  data-test='confirm-new-password'
                />
              </FormControl>
            </GridItem>
          </GridContainer>
        </CardBody>
      ) : usernamePasswordMethod ? (
        <CardBody>
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <FormLabel component='legend' style={{ fontSize: '1.2rem', marginTop: 10 }}>
                Login
              </FormLabel>
              <FormControl fullWidth>
                <InputLabel htmlFor='username'>Username</InputLabel>
                <Input
                  id='username'
                  type='text'
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  autoFocus
                  data-test='username'
                />
              </FormControl>
            </GridItem>
          </GridContainer>
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <FormControl fullWidth>
                <InputLabel htmlFor='password'>Password</InputLabel>
                <Input
                  id='password'
                  type='password'
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  data-test='password'
                />
              </FormControl>
            </GridItem>
          </GridContainer>
        </CardBody>
      ) : (
        <CardBody>
          <FormLabel
            component='legend'
            style={{ fontSize: '1rem', marginTop: 10, marginBottom: 0 }}
          >
            Username/password authentication is not enabled at this time.
          </FormLabel>
        </CardBody>
      )}
      <CardFooter style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!isLoading ? (
          <>
            {requirePasswordChange ? (
              <Button
                color='success'
                block
                disabled={!canSubmitPasswordChange}
                type='submit'
                data-test='password-change'
              >
                Update password
              </Button>
            ) : (
              usernamePasswordMethod && (
                <Button
                  color='success'
                  block
                  disabled={!canSubmitLogin}
                  type='submit'
                  data-test='login'
                >
                  Login
                </Button>
              )
            )}
            {!requirePasswordChange &&
              authMethods.map((authMethod) => (
                <Button
                  color='success'
                  block
                  onClick={() => onAuthMethodLogin(authMethod)}
                  data-test={`${authMethod}-login`}
                  key={authMethod}
                >
                  Login
                  {authMethods.length > 1 || usernamePasswordMethod
                    ? ` with ${authMethod.toUpperCase()}`
                    : ''}
                </Button>
              ))}
          </>
        ) : (
          <div style={{ textAlign: 'center', width: '100%', opacity: 0.5, color: 'green' }}>
            <CircularProgress color='inherit' />
          </div>
        )}
      </CardFooter>
    </>
  );
};

export default AuthFormSection;
