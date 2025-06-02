import React, { useEffect, useState } from 'react';
import { Snackbar, TableCell, TableRow } from '@material-ui/core';
import GridContainer from '../../../components/Grid/GridContainer';
import GridItem from '../../../components/Grid/GridItem';
import { CodeReviewIcon, LawIcon, PeopleIcon } from '@primer/octicons-react';
import axios from 'axios';
import moment from 'moment';
import CodeActionButton from '../../../components/CustomButtons/CodeActionButton';
import { languageColors } from '../../../../constants/languageColors';

interface RepositoriesProps {
  data: {
    project: string;
    name: string;
    proxyURL: string;
    users?: {
      canPush?: string[];
      canAuthorise?: string[];
    };
  };
}

interface GitHubRepository {
  description?: string;
  language?: string;
  license?: {
    spdx_id: string;
  };
  parent?: {
    full_name: string;
    html_url: string;
  };
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
}

const Repositories: React.FC<RepositoriesProps> = (props) => {
  const [github, setGitHub] = useState<GitHubRepository>({});

  const [errorMessage, setErrorMessage] = React.useState('');
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);

  useEffect(() => {
    getGitHubRepository();
  }, [props.data.project, props.data.name]);

  const getGitHubRepository = async () => {
    await axios
      .get(`https://api.github.com/repos/${props.data.project}/${props.data.name}`)
      .then((res) => {
        setGitHub(res.data);
      })
      .catch((error) => {
        setErrorMessage(
          `Error fetching GitHub repository ${props.data.project}/${props.data.name}: ${error}`,
        );
        setSnackbarOpen(true);
      });
  };

  const { project: org, name, proxyURL } = props?.data || {};
  const cloneURL = `${proxyURL}/${org}/${name}.git`;

  return (
    <TableRow>
      <TableCell>
        <div style={{ padding: '15px' }}>
          <a href={`/dashboard/repo/${props.data.name}`}>
            <span style={{ fontSize: '17px' }}>
              {props.data.project}/{props.data.name}
            </span>
          </a>
          {github.parent && (
            <span
              style={{
                fontSize: '11.5px',
                display: 'block',
                opacity: 0.8,
              }}
            >
              Forked from{' '}
              <a
                style={{
                  fontWeight: 'normal',
                  color: 'inherit',
                }}
                href={github.parent.html_url}
              >
                {github.parent.full_name}
              </a>
            </span>
          )}
          {github.description && <p style={{ maxWidth: '80%' }}>{github.description}</p>}
          <GridContainer>
            {github.language && (
              <GridItem>
                <span
                  style={{
                    height: '12px',
                    width: '12px',
                    backgroundColor: `${languageColors[github.language] || '#ccc'}`,
                    borderRadius: '50px',
                    display: 'inline-block',
                    marginRight: '5px',
                  }}
                ></span>
                {github.language}
              </GridItem>
            )}
            {github.license && (
              <GridItem>
                <LawIcon size='small' />{' '}
                <span style={{ marginLeft: '5px' }}>{github.license.spdx_id}</span>
              </GridItem>
            )}
            <GridItem>
              <PeopleIcon size='small' />{' '}
              <span style={{ marginLeft: '5px' }}>{props.data.users?.canPush?.length || 0}</span>
            </GridItem>
            <GridItem>
              <CodeReviewIcon size='small' />{' '}
              <span style={{ marginLeft: '5px' }}>
                {props.data.users?.canAuthorise?.length || 0}
              </span>
            </GridItem>
            {(github.created_at || github.updated_at || github.pushed_at) && (
              <GridItem>
                Last updated{' '}
                {moment
                  .max([
                    moment(github.created_at || 0),
                    moment(github.updated_at || 0),
                    moment(github.pushed_at || 0),
                  ])
                  .fromNow()}
              </GridItem>
            )}
          </GridContainer>
        </div>
      </TableCell>
      <TableCell align='right'>
        <div style={{ padding: '15px' }}>
          <CodeActionButton cloneURL={cloneURL} />
        </div>
      </TableCell>
      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={errorMessage}
      />
    </TableRow>
  );
};

export default Repositories;
