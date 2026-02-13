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

import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '@material-ui/core/Icon';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardIcon from '../../components/Card/CardIcon';
import CardBody from '../../components/Card/CardBody';
import CardHeader, { CardHeaderColor } from '../../components/Card/CardHeader';
import CardFooter from '../../components/Card/CardFooter';
import Button from '../../components/CustomButtons/Button';
import Diff from './components/Diff';
import Attestation from './components/Attestation';
import AttestationView from './components/AttestationView';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { getPush, authorisePush, rejectPush, cancelPush } from '../../services/git-push';
import { CheckCircle, Visibility, Cancel, Block } from '@material-ui/icons';
import Snackbar from '@material-ui/core/Snackbar';
import Tooltip from '@material-ui/core/Tooltip';
import { AttestationFormData, PushActionView } from '../../types';
import { trimPrefixRefsHeads, trimTrailingDotGit } from '../../../db/helper';
import { generateEmailLink, getGitProvider } from '../../utils';
import UserLink from '../../components/UserLink/UserLink';

const Dashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [push, setPush] = useState<PushActionView | null>(null);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [message, setMessage] = useState('');
  const [attestation, setAttestation] = useState(false);
  const navigate = useNavigate();

  let isUserAllowedToApprove = true;
  let isUserAllowedToReject = true;

  const setUserAllowedToApprove = (userAllowedToApprove: boolean) => {
    isUserAllowedToApprove = userAllowedToApprove;
  };

  const setUserAllowedToReject = (userAllowedToReject: boolean) => {
    isUserAllowedToReject = userAllowedToReject;
  };

  useEffect(() => {
    if (id) {
      getPush(id, setIsLoading, setPush, setAuth, setIsError);
    }
  }, [id]);

  const authorise = async (attestationData: Array<{ label: string; checked: boolean }>) => {
    if (!id) return;
    await authorisePush(id, setMessage, setUserAllowedToApprove, attestationData);
    if (isUserAllowedToApprove) {
      navigate('/dashboard/push/');
    }
  };

  const reject = async () => {
    if (!id) return;
    await rejectPush(id, setMessage, setUserAllowedToReject);
    if (isUserAllowedToReject) {
      navigate('/dashboard/push/');
    }
  };

  const cancel = async () => {
    if (!id) return;
    await cancelPush(id, setAuth, setIsError);
    navigate(`/dashboard/push/`);
  };

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!push) return <div>No push data found</div>;

  let headerData: { title: string; color: CardHeaderColor } = {
    title: 'Pending',
    color: 'warning',
  };

  if (push.canceled) {
    headerData = {
      color: 'warning',
      title: 'Canceled',
    };
  }

  if (push.rejected) {
    headerData = {
      color: 'danger',
      title: 'Rejected',
    };
  }

  if (push.authorised) {
    headerData = {
      color: 'success',
      title: 'Approved',
    };
  }

  const repoFullName = trimTrailingDotGit(push.repo);
  const repoBranch = trimPrefixRefsHeads(push.branch ?? '');
  const repoUrl = push.url;
  const repoWebUrl = trimTrailingDotGit(repoUrl);
  const gitProvider = getGitProvider(repoUrl);
  const isGitHub = gitProvider == 'github';

  const generateIcon = (title: string) => {
    switch (title) {
      case 'Approved':
        return <CheckCircle />;
      case 'Pending':
        return <Visibility />;
      case 'Canceled':
        return <Cancel />;
      case 'Rejected':
        return <Block />;
      default:
        return <Icon />;
    }
  };

  return (
    <div>
      <Snackbar
        open={!!message}
        message={message}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        autoHideDuration={5000}
        onClose={() => setMessage('')}
      />
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <Card>
            <CardHeader color={headerData.color} stats icon>
              <CardIcon color={headerData.color}>
                {generateIcon(headerData.title)}
                <h3>{headerData.title}</h3>
              </CardIcon>
              {!(push.canceled || push.rejected || push.authorised) && (
                <div style={{ display: 'inline-flex', padding: '20px' }}>
                  <Button color='warning' onClick={cancel}>
                    Cancel
                  </Button>
                  <Button color='danger' onClick={reject}>
                    Reject
                  </Button>
                  <Attestation approveFn={authorise} />
                </div>
              )}
              {push.attestation && push.authorised && (
                <div
                  style={{
                    background: '#eee',
                    padding: '10px 20px 10px 20px',
                    borderRadius: '10px',
                    color: 'black',
                    marginTop: '15px',
                    float: 'right',
                    position: 'relative',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ position: 'absolute', top: 0, right: 0 }}>
                    <CheckCircle
                      style={{
                        cursor: push.autoApproved ? 'default' : 'pointer',
                        transform: 'scale(0.65)',
                        opacity: push.autoApproved ? 0.5 : 1,
                      }}
                      onClick={() => {
                        if (!push.autoApproved) {
                          setAttestation(true);
                        }
                      }}
                      htmlColor='green'
                    />
                  </span>

                  {push.autoApproved ? (
                    <div style={{ paddingTop: '15px' }}>
                      <p>
                        <strong>Auto-approved by system</strong>
                      </p>
                    </div>
                  ) : (
                    <>
                      {isGitHub && (
                        <UserLink username={push.attestation.reviewer.username}>
                          <img
                            style={{ width: '45px', borderRadius: '20px' }}
                            src={`https://github.com/${push.attestation.reviewer.gitAccount}.png`}
                          />
                        </UserLink>
                      )}
                      <div>
                        <p>
                          {isGitHub && (
                            <UserLink username={push.attestation.reviewer.username}>
                              {push.attestation.reviewer.gitAccount}
                            </UserLink>
                          )}
                          {!isGitHub && <UserLink username={push.attestation.reviewer.username} />}{' '}
                          approved this contribution
                        </p>
                      </div>
                    </>
                  )}

                  <Tooltip
                    title={moment(push.attestation.timestamp).format(
                      'dddd, MMMM Do YYYY, h:mm:ss a',
                    )}
                    arrow
                  >
                    <kbd style={{ color: 'black', float: 'right' }}>
                      {moment(push.attestation.timestamp).fromNow()}
                    </kbd>
                  </Tooltip>

                  {!push.autoApproved && (
                    <AttestationView
                      data={push.attestation as AttestationFormData}
                      attestation={attestation}
                      setAttestation={setAttestation}
                    />
                  )}
                </div>
              )}
            </CardHeader>
            <CardBody>
              <GridContainer>
                <GridItem xs={2} sm={2} md={2}>
                  <h3>Timestamp</h3>
                  <p>{moment(push.timestamp).toString()}</p>
                </GridItem>
                <GridItem xs={3} sm={3} md={3}>
                  <h3>Remote Head</h3>
                  <p>
                    <a
                      href={`${repoWebUrl}/commit/${push.commitFrom}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {push.commitFrom}
                    </a>
                  </p>
                </GridItem>
                <GridItem xs={3} sm={3} md={3}>
                  <h3>Commit SHA</h3>
                  <p>
                    <a
                      href={`${repoWebUrl}/commit/${push.commitTo}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {push.commitTo}
                    </a>
                  </p>
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <h3>Repository</h3>
                  <p>
                    <a href={`${repoWebUrl}`} rel='noreferrer' target='_blank'>
                      {repoFullName}
                    </a>
                  </p>
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <h3>Branch</h3>
                  <p>
                    <a href={`${repoWebUrl}/tree/${repoBranch}`} rel='noreferrer' target='_blank'>
                      {repoBranch}
                    </a>
                  </p>
                </GridItem>
              </GridContainer>
            </CardBody>
          </Card>
          <Card>
            <CardHeader color={headerData.color} stats icon>
              <h3>{headerData.title}</h3>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Committer</TableCell>
                    <TableCell>Author</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {push.commitData?.map((c) => (
                    <TableRow key={c.commitTimestamp}>
                      <TableCell>
                        {moment.unix(Number(c.commitTimestamp || 0)).toString()}
                      </TableCell>
                      <TableCell>{generateEmailLink(c.committer, c.committerEmail)}</TableCell>
                      <TableCell>{generateEmailLink(c.author, c.authorEmail)}</TableCell>
                      <TableCell>{c.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem xs={12} sm={12} md={12}>
          <Card>
            <CardHeader />
            <CardBody>
              <Diff diff={push.diff.content} />
            </CardBody>
            <CardFooter />
          </Card>
        </GridItem>
      </GridContainer>
    </div>
  );
};

export default Dashboard;
