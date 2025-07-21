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
import { PushData } from '../../../types/models';
import { trimPrefixRefsHeads, trimTrailingDotGit } from '../../../db/helper';
import { getGitProvider } from '../../utils';

const Dashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PushData | null>(null);
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
    console.log('isUserAllowedToApprove:' + isUserAllowedToApprove);
  };

  const setUserAllowedToReject = (userAllowedToReject: boolean) => {
    isUserAllowedToReject = userAllowedToReject;
    console.log({ isUserAllowedToReject });
  };

  useEffect(() => {
    if (id) {
      getPush(id, setIsLoading, setData, setAuth, setIsError);
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
  if (!data) return <div>No data found</div>;

  let headerData: { title: string; color: CardHeaderColor } = {
    title: 'Pending',
    color: 'warning',
  };

  if (data.canceled) {
    headerData = {
      color: 'warning',
      title: 'Canceled',
    };
  }

  if (data.rejected) {
    headerData = {
      color: 'danger',
      title: 'Rejected',
    };
  }

  if (data.authorised) {
    headerData = {
      color: 'success',
      title: 'Approved',
    };
  }

  const repoFullName = trimTrailingDotGit(data.repo);
  const repoBranch = trimPrefixRefsHeads(data.branch);
  const repoUrl = data.url;
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
              {!(data.canceled || data.rejected || data.authorised) && (
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
              {data.attestation && data.authorised && (
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
                        cursor: data.autoApproved ? 'default' : 'pointer',
                        transform: 'scale(0.65)',
                        opacity: data.autoApproved ? 0.5 : 1,
                      }}
                      onClick={() => {
                        if (!data.autoApproved) {
                          setAttestation(true);
                        }
                      }}
                      htmlColor='green'
                    />
                  </span>

                  {data.autoApproved ? (
                    <div style={{ paddingTop: '15px' }}>
                      <p>
                        <strong>Auto-approved by system</strong>
                      </p>
                    </div>
                  ) : (
                    <>
                      {isGitHub && (
                        <a href={`/dashboard/user/${data.attestation.reviewer.username}`}>
                          <img
                            style={{ width: '45px', borderRadius: '20px' }}
                            src={`https://github.com/${data.attestation.reviewer.gitAccount}.png`}
                          />
                        </a>
                      )}
                      <div>
                        <p>
                          {isGitHub && (
                            <a href={`/dashboard/user/${data.attestation.reviewer.username}`}>
                              {data.attestation.reviewer.gitAccount}
                            </a>
                          )}
                          {!isGitHub && (
                            <a href={`/dashboard/user/${data.attestation.reviewer.username}`}>
                              {data.attestation.reviewer.username}
                            </a>
                          )}{' '}
                          approved this contribution
                        </p>
                      </div>
                    </>
                  )}

                  <Tooltip
                    title={moment(data.attestation.timestamp).format(
                      'dddd, MMMM Do YYYY, h:mm:ss a',
                    )}
                    arrow
                  >
                    <kbd style={{ color: 'black', float: 'right' }}>
                      {moment(data.attestation.timestamp).fromNow()}
                    </kbd>
                  </Tooltip>

                  {!data.autoApproved && (
                    <AttestationView
                      data={data.attestation}
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
                  <p>{moment(data.timestamp).toString()}</p>
                </GridItem>
                <GridItem xs={3} sm={3} md={3}>
                  <h3>Remote Head</h3>
                  <p>
                    <a
                      href={`${repoWebUrl}/commit/${data.commitFrom}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {data.commitFrom}
                    </a>
                  </p>
                </GridItem>
                <GridItem xs={3} sm={3} md={3}>
                  <h3>Commit SHA</h3>
                  <p>
                    <a
                      href={`${repoWebUrl}/commit/${data.commitTo}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {data.commitTo}
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
                    <TableCell>Author E-mail</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.commitData.map((c) => (
                    <TableRow key={c.commitTimestamp || c.commitTs}>
                      <TableCell>
                        {moment.unix(c.commitTs || c.commitTimestamp || 0).toString()}
                      </TableCell>
                      <TableCell>
                        {isGitHub && (
                          <a
                            href={`https://github.com/${c.committer}`}
                            rel='noreferrer'
                            target='_blank'
                          >
                            {c.committer}
                          </a>
                        )}
                        {!isGitHub && <span>{c.committer}</span>}
                      </TableCell>
                      <TableCell>
                        {isGitHub && (
                          <a
                            href={`https://github.com/${c.author}`}
                            rel='noreferrer'
                            target='_blank'
                          >
                            {c.author}
                          </a>
                        )}
                        {!isGitHub && <span>{c.author}</span>}
                      </TableCell>
                      <TableCell>
                        {c.authorEmail ? (
                          <a href={`mailto:${c.authorEmail}`}>{c.authorEmail}</a>
                        ) : (
                          'No data...'
                        )}
                      </TableCell>
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
              <Diff diff={data.diff.content} />
            </CardBody>
            <CardFooter />
          </Card>
        </GridItem>
      </GridContainer>
    </div>
  );
};

export default Dashboard;
