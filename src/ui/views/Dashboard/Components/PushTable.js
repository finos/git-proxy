/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState, useEffect} from 'react';
import axios from 'axios';
import BugReport from '@material-ui/icons/BugReport';
import Code from '@material-ui/icons/Code';
import Table from '../../../components/Table/Table.js';
import CustomTabs from '../../../components/CustomTabs/CustomTabs.js';
import {Redirect} from 'react-router-dom';


export default function PushesWaitingAuthorizationGraph() {
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const url = 'http://localhost:8080/api/v1/push';
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsError(false);
      setIsLoading(true);
      await axios(url, {withCredentials: true}).then((response) => {
        console.log('---- OK ----');
        const data = response.data.map((x) => [
          x.repo,
          x.branch.replace('refs/heads/', ''),
          x.commitFrom.substring(0, 8),
          x.commitTo.substring(0, 8),
        ]);

        console.log(data);
        setData(data);
        setAuth(true);
        setIsLoading(false);
        setIsError(false);
      }).catch((error) => {
        console.log(JSON.stringify(error));
        setIsLoading(false);
        if (error.response && error.response.status === 401) {
          setAuth(false);
        } else {
          setIsError(true);
        }
      });
    };

    fetchData();
  }, [url]);

  if (isLoading) return (<div>Loading ...</div>);
  if (isError) return (<div>Something went wrong ...</div>);
  if (!auth) return (<Redirect to={{pathname: '/login'}} />);

  return (
    <CustomTabs
      title="Tasks:"
      headerColor="primary"
      tabs={[
        {
          tabName: 'Waiting Authorization',
          tabIcon: Code,
          tabContent: (
            isLoading ? (
              <div>Loading ...</div>
            ) : (
            <Table
              tableHeaderColor="warning"
              tableHead={['repo', 'branch', 'from', 'to']}
              tableData={data}
            />
            )
          ),
        },
        {
          tabName: 'Rejections',
          tabIcon: BugReport,
          tabContent: (
            <Table
              tableHeaderColor="warning"
              tableHead={['Name', 'provider', 'repo', 'branch', 'reason']}
              tableData={[
                ['Dakota Rice', 'github', 'finos/datahub', 'enhance-markov-model', 'password discoverd'],
                ['Minerva Hooper', 'github', 'pgrovesy/git-proxy', 'enhance-markov-model', 'bad commit message'],
              ]}
            />
          ),
        },
      ]}
    />
  );
}
