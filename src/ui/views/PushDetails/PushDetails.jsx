import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '@mui/material/Icon';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardIcon from '../../components/Card/CardIcon';
import CardBody from '../../components/Card/CardBody';
import CardHeader from '../../components/Card/CardHeader';
import CardFooter from '../../components/Card/CardFooter';
import Button from '../../components/CustomButtons/Button';
import Diff from './components/Diff';
import Attestation from './components/Attestation';
import AttestationView from './components/AttestationView';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import { getPush, authorisePush, rejectPush, cancelPush } from '../../services/git-push';
import { CheckCircle, Visibility, Cancel, Block } from '@mui/icons-material';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';

export default function Dashboard() {
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [message, setMessage] = useState('');
  const [attestation, setAttestation] = useState(false);
  const navigate = useNavigate();
  let isUserAllowedToApprove = true;
  let isUserAllowedToReject = true;
  function setUserAllowedToApprove(userAllowedToApprove) {
    isUserAllowedToApprove = userAllowedToApprove;
    console.log('isUserAllowedToApprove:' + isUserAllowedToApprove);
  }
  function setUserAllowedToReject(userAllowedToReject) {
    isUserAllowedToReject = userAllowedToReject;
    console.log({ isUserAllowedToReject });
  }
  useEffect(() => {
    getPush(id, setIsLoading, setData, setAuth, setIsError);
  }, [id]);
  const authorise = async (attestationData) => {
    await authorisePush(id, setMessage, setUserAllowedToApprove, attestationData);
    if (isUserAllowedToApprove) {
      navigate('/admin/push/');
    }
  };

  const reject = async () => {
    await rejectPush(id, setMessage, setUserAllowedToReject);
    if (isUserAllowedToReject) {
      navigate('/admin/push/');
    }
  };

  const cancel = async () => {
    await cancelPush(id, setAuth, setIsError);
    navigate(`/admin/push/`);
  };

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong ...</div>;

  let headerData = {
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

  const repoFullName = data.repo.replace('.git', '');
  const repoBranch = data.branch.replace('refs/heads/', '');

  const generateIcon = (title) => {
    switch (title) {
      case 'Approved':
        return <CheckCircle></CheckCircle>;
      case 'Pending':
        return <Visibility></Visibility>;
      case 'Canceled':
        return <Cancel></Cancel>;
      case 'Rejected':
        return <Block></Block>;
      default:
        return <Icon></Icon>;
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
              {!(data.canceled || data.rejected || data.authorised) ? (
                <div style={{ display: 'inline-flex', padding: '20px' }}>
                  <Button
                    color='warning'
                    onClick={async () => {
                      await cancel();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    color='danger'
                    onClick={async () => {
                      await reject();
                    }}
                  >
                    Reject
                  </Button>
                  <Attestation approveFn={authorise}></Attestation>
                </div>
              ) : null}
              {data.attestation && data.authorised ? (
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
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                    }}
                  >
                    <CheckCircle
                      style={{ cursor: 'pointer', transform: 'scale(0.65)' }}
                      onClick={() => setAttestation(true)}
                      htmlColor='green'
                    />
                  </span>
                  <a href={`/admin/user/${data.attestation.reviewer.username}`}>
                    <img
                      style={{ width: '45px', borderRadius: '20px' }}
                      src={`https://github.com/${data.attestation.reviewer.gitAccount}.png`}
                    />
                  </a>
                  <div>
                    <p>
                      <a href={`/admin/user/${data.attestation.reviewer.username}`}>
                        {data.attestation.reviewer.gitAccount}
                      </a>{' '}
                      approved this contribution
                    </p>
                    <Tooltip
                      title={moment(data.attestation.timestamp).format(
                        'dddd, MMMM Do YYYY, h:mm:ss a',
                      )}
                      arrow
                    >
                      <kbd
                        style={{
                          color: 'black',
                          float: 'right',
                        }}
                      >
                        {moment(data.attestation.timestamp).fromNow()}
                      </kbd>
                    </Tooltip>
                  </div>
                  <AttestationView
                    data={data.attestation}
                    attestation={attestation}
                    setAttestation={setAttestation}
                  />
                </div>
              ) : null}
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
                      href={`https://github.com/${repoFullName}/commit/${data.commitFrom}`}
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
                      href={`https://github.com/${repoFullName}/commit/${data.commitTo}`}
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
                    <a href={`https://github.com/${repoFullName}`} rel='noreferrer' target='_blank'>
                      {repoFullName}
                    </a>
                  </p>
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <h3>Branch</h3>
                  <p>
                    <a
                      href={`https://github.com/${repoFullName}/tree/${repoBranch}`}
                      rel='noreferrer'
                      target='_blank'
                    >
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
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Committer</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell>Author E-mail</TableCell>
                  <TableCell>Message</TableCell>
                </TableHead>
                <TableBody>
                  {data.commitData.map((c) => (
                    <TableRow key={c.commitTimestamp}>
                      <TableCell>
                        {moment.unix(c.commitTs || c.commitTimestamp).toString()}
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://github.com/${c.committer}`}
                          rel='noreferrer'
                          target='_blank'
                        >
                          {c.committer}
                        </a>
                      </TableCell>
                      <TableCell>
                        <a href={`https://github.com/${c.author}`} rel='noreferrer' target='_blank'>
                          {c.author}
                        </a>
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
            <CardHeader></CardHeader>
            <CardBody>
              <Diff diff={data.diff.content} />
            </CardBody>
            <CardFooter></CardFooter>
          </Card>
        </GridItem>
      </GridContainer>
    </div>
  );
}
