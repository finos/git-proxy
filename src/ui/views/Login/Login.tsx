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

import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router';
import { Button, Flash, FormControl, Stack, Text, TextInput } from '@primer/react';
import { MarkGithubIcon } from '@primer/octicons-react';
import axios, { AxiosError } from 'axios';
import logo from '../../assets/img/git-proxy.png';
import { useAuth } from '../../auth/AuthProvider';
import { getBaseUrl } from '../../services/apiConfig';
import { getAxiosConfig, processAuthError } from '../../services/auth';

interface LoginResponse {
  username: string;
  password: string;
}

const Login = () => {
  const navigate = useNavigate();
  const authContext = useAuth();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [gitAccountError, setGitAccountError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authMethods, setAuthMethods] = useState<string[]>([]);
  const [usernamePasswordMethod, setUsernamePasswordMethod] = useState<string>('');

  useEffect(() => {
    const fetchAuthConfig = async () => {
      const baseUrl = await getBaseUrl();
      const response = await axios.get(`${baseUrl}/api/auth/config`);
      const usernamePasswordMethod = response.data.usernamePasswordMethod;
      const otherMethods = response.data.otherMethods;

      setUsernamePasswordMethod(usernamePasswordMethod);
      setAuthMethods(otherMethods);

      // Automatically login if only one non-username/password method is enabled
      if (!usernamePasswordMethod && otherMethods.length === 1) {
        await handleAuthMethodLogin(otherMethods[0]);
      }
    };
    fetchAuthConfig();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const t = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(t);
  }, [message]);

  function validateForm(): boolean {
    return (
      username.length > 0 && username.length < 100 && password.length > 0 && password.length < 200
    );
  }

  async function handleAuthMethodLogin(authMethod: string): Promise<void> {
    const baseUrl = await getBaseUrl();
    window.location.href = `${baseUrl}/api/auth/${authMethod}`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsLoading(true);

    try {
      const baseUrl = await getBaseUrl();
      const loginUrl = `${baseUrl}/api/auth/login`;
      await axios.post<LoginResponse>(loginUrl, { username, password }, getAxiosConfig());
      window.sessionStorage.setItem('git.proxy.login', 'success');
      setMessage('Success!');
      setSuccess(true);
      await authContext.refreshUser();
      navigate(0);
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 307) {
          window.sessionStorage.setItem('git.proxy.login', 'success');
          setGitAccountError(true);
        } else if (error.response?.status === 403) {
          setMessage(processAuthError(error, false));
        } else {
          setMessage('You entered an invalid username or password.');
        }
      } else {
        setMessage('You entered an invalid username or password.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (gitAccountError) {
    return <Navigate to='/dashboard/profile' />;
  }

  if (success) {
    return <Navigate to='/dashboard/repo' />;
  }

  const showErrorFlash = Boolean(message.trim());

  return (
    <form
      data-testid='login-form'
      onSubmit={handleSubmit}
      className='flex min-h-screen flex-col items-center justify-center bg-(--bgColor-muted) px-4 py-10 font-normal'
    >
      <div className='w-full max-w-100'>
        <Stack direction='vertical' gap='normal' padding='none'>
          <div className='overflow-hidden rounded-2xl border border-(--borderColor-default) bg-(--bgColor-default) shadow-[0_12px_36px_-12px_rgba(1,4,9,0.2),0_4px_16px_-8px_rgba(1,4,9,0.08)]'>
            <div className='border-b border-gray-800 bg-gray-900 px-8 py-8'>
              <div className='flex justify-center'>
                <img
                  src={logo}
                  alt='GitProxy'
                  className='h-auto max-h-17 w-auto max-w-[min(100%,18rem)] object-contain object-center'
                  data-test='git-proxy-logo'
                />
              </div>
            </div>

            <div className='px-8 py-7'>
              <Stack direction='vertical' gap='normal' padding='none'>
                {!usernamePasswordMethod ? (
                  <div className='text-center'>
                    <Text
                      as='p'
                      size='medium'
                      weight='normal'
                      className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
                    >
                      Choose a sign-in method below.
                    </Text>
                  </div>
                ) : null}

                {usernamePasswordMethod ? (
                  <Stack direction='vertical' gap='normal' padding='none'>
                    <FormControl id='username'>
                      <FormControl.Label>Username</FormControl.Label>
                      <TextInput
                        name='username'
                        type='text'
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoFocus
                        autoComplete='username'
                        block
                        data-test='username'
                      />
                    </FormControl>
                    <FormControl id='password'>
                      <FormControl.Label>Password</FormControl.Label>
                      <TextInput
                        name='password'
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete='current-password'
                        block
                        data-test='password'
                      />
                    </FormControl>
                  </Stack>
                ) : (
                  <Text
                    as='p'
                    size='medium'
                    weight='normal'
                    className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
                  >
                    Username/password authentication is not enabled at this time.
                  </Text>
                )}

                <Stack direction='vertical' gap='condensed' padding='none' className='w-full mt-2!'>
                  {usernamePasswordMethod ? (
                    <Button
                      type='submit'
                      variant='primary'
                      size='large'
                      disabled={!validateForm() || isLoading}
                      loading={isLoading}
                      loadingAnnouncement='Signing in'
                      block
                      data-test='login'
                    >
                      Sign in
                    </Button>
                  ) : null}
                  {authMethods.map((am) => {
                    const upper = am.toUpperCase();
                    const isGithub = am.toLowerCase() === 'github';
                    return (
                      <Button
                        key={am}
                        type='button'
                        variant='primary'
                        size='large'
                        block
                        disabled={isLoading}
                        data-test={`${am}-login`}
                        onClick={() => handleAuthMethodLogin(am)}
                        leadingVisual={isGithub ? MarkGithubIcon : undefined}
                      >
                        Continue with {upper}
                      </Button>
                    );
                  })}
                </Stack>
              </Stack>
            </div>
          </div>
          {showErrorFlash ? (
            <Flash
              variant='danger'
              className='m-0 rounded-xl border border-(--borderColor-danger-muted) shadow-sm'
              data-test='login-error'
            >
              {message}
            </Flash>
          ) : null}
        </Stack>
      </div>
    </form>
  );
};

export default Login;
