import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import moment from 'moment';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '@material-ui/core/Icon';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardIcon from '../../components/Card/CardIcon';
import CardBody from '../../components/Card/CardBody';
import CardHeader from '../../components/Card/CardHeader';
import CardFooter from '../../components/Card/CardFooter';
import Button from '../../components/CustomButtons/Button';
import Diff from './components/Diff';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { getPush, authorisePush, rejectPush, cancelPush } from '../../services/git-push';

export default function Dashboard() {
  // eslint-disable-next-line react/prop-types
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const history = useNavigate();

  useEffect(() => {
    getPush(id, setIsLoading, setData, setAuth, setIsError);
  }, [id]);

  const authorise = async () => {
    await authorisePush(id, setAuth, setIsError);
    history.push(`/admin/push/`);
  };

  const reject = async () => {
    await rejectPush(id, setAuth, setIsError);
    history.push(`/admin/push/`);
  };

  const cancel = async () => {
    await cancelPush(id, setAuth, setIsError);
    history.push(`/admin/push/`);
  };

  if (isLoading) return <div>Loading ...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!auth) return <Navigate to={{ pathname: '/login' }} />;

  let headerData = {
    title: 'Waiting Approval',
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
      title: 'REJECTED',
    };
  }

  if (data.authorised) {
    headerData = {
      color: 'success',
      title: 'Approved!',
    };
  }

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardHeader color={headerData.color} stats icon>
            <CardIcon color={headerData.color}>
              <Icon>content_copy</Icon>
              <h3>{headerData.title}</h3>
            </CardIcon>
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
              Rject
            </Button>
            <Button
              color='success'
              onClick={async () => {
                await authorise();
              }}
            >
              Approve
            </Button>
          </CardHeader>
          <CardBody>
            <GridContainer>
              <GridItem xs={2} sm={2} md={2}>
                <h3>Timestamp</h3>
                <p>{moment(data.timestamp).toString()}</p>
              </GridItem>
              <GridItem xs={3} sm={3} md={3}>
                <h3>Remote Head</h3>
                <p>{data.commitFrom}</p>
              </GridItem>
              <GridItem xs={3} sm={3} md={3}>
                <h3>Commit</h3>
                <p>{data.commitTo}</p>
              </GridItem>
              <GridItem xs={2} sm={2} md={2}>
                <h3>Repo</h3>
                <p>{data.repo}</p>
              </GridItem>
              <GridItem xs={2} sm={2} md={2}>
                <h3>Branch</h3>
                <p>{data.branch.replace('refs/heads/', '')}</p>
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
                <TableCell>Parent#</TableCell>
                <TableCell>Committer</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>Message</TableCell>
              </TableHead>
              <TableBody>
                {data.commitData.map((c) => (
                  <TableRow key={c.commitTs}>
                    <TableCell>{c.parent}</TableCell>
                    <TableCell>{c.committer}</TableCell>
                    <TableCell>{c.author}</TableCell>
                    <TableCell>
                      {moment(Date(c.commitTs)).format('yyyy-MM-DD HH:mm:ss.mmmm')}
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
  );
}
