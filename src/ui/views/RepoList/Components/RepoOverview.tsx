import React, { useEffect } from 'react';
import { Snackbar, TableCell, TableRow } from '@material-ui/core';
import GridContainer from '../../../components/Grid/GridContainer';
import GridItem from '../../../components/Grid/GridItem';
import { CodeReviewIcon, LawIcon, PeopleIcon } from '@primer/octicons-react';
import axios from 'axios';
import moment from 'moment';
import CodeActionButton from '../../../components/CustomButtons/CodeActionButton';
import { languageColors } from '../../../../constants/languageColors';
import { RepositoriesProps } from '../repositories.types';

interface GitHubRepositoryMetadata {
  description?: string;
  language?: string;
  license?: {
    spdx_id: string;
  };
  html_url: string;
  parent?: {
    full_name: string;
    html_url: string;
  };
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
}

interface GitLabRepositoryMetadata {
  description?: string;
  primary_language?: string;
  license?: {
    nickname: string;
  };
  web_url: string;
  forked_from_project?: {
    full_name: string;
    web_url: string;
  };
  last_activity_at?: string;
}

interface DisplayMetadata {
  description?: string;
  language?: string;
  license?: string;
  htmlUrl?: string;
  parentName?: string;
  parentUrl?: string;
  lastUpdated?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
}

const Repositories: React.FC<RepositoriesProps> = (props) => {
  const [remoteRepoData, setRemoteRepoData] = React.useState<
    GitHubRepositoryMetadata | GitLabRepositoryMetadata | null
  >(null);
  const [provider, setProvider] = React.useState<'github' | 'gitlab' | 'unknown' | null>(null);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);

  useEffect(() => {
    fetchRemoteRepositoryData();
  }, [props.data.project, props.data.name, props.data.url]);

  const fetchRemoteRepositoryData = async () => {
    try {
      const { url: remoteUrl } = props.data;
      if (!remoteUrl) return;

      const parsedUrl = new URL(remoteUrl);
      const hostname = parsedUrl.hostname.toLowerCase();

      if (hostname === 'github.com') {
        setProvider('github');
        const response = await axios.get<GitHubRepositoryMetadata>(
          `https://api.github.com/repos/${props.data?.project}/${props.data?.name}`,
        );
        setRemoteRepoData(response.data);
      } else if (hostname.includes('gitlab')) {
        setProvider('gitlab');
        const projectPath = encodeURIComponent(`${props.data?.project}/${props.data?.name}`);
        const apiUrl = `https://${hostname}/api/v4/projects/${projectPath}`;
        const response = await axios.get<GitLabRepositoryMetadata>(apiUrl);

        // Make follow-up call to get languages
        let primaryLanguage;
        try {
          const languagesResponse = await axios.get(
            `https://${hostname}/api/v4/projects/${projectPath}/languages`,
          );
          const languages = languagesResponse.data;
          // Get the first key (primary language) from the ordered hash
          primaryLanguage = Object.keys(languages)[0];
        } catch (languageError) {
          console.warn('Could not fetch language data:', languageError);
        }

        setRemoteRepoData({
          ...response.data,
          primary_language: primaryLanguage,
        });
      } // For other/unknown providers, don't make API calls
    } catch (error: any) {
      setErrorMessage(`Error fetching repository data: ${error.message}`);
      setSnackbarOpen(true);
    }
  };

  // Helper function to normalize data across providers
  const getDisplayData = (): DisplayMetadata => {
    if (!remoteRepoData) return {};

    if (provider === 'github') {
      const gitHubMetadata = remoteRepoData as GitHubRepositoryMetadata;
      return {
        description: gitHubMetadata.description,
        language: gitHubMetadata.language,
        license: gitHubMetadata.license?.spdx_id,
        lastUpdated: moment
          .max([
            moment(gitHubMetadata.created_at),
            moment(gitHubMetadata.updated_at),
            moment(gitHubMetadata.pushed_at),
          ])
          .fromNow(),
        htmlUrl: gitHubMetadata.html_url,
        parentName: gitHubMetadata.parent?.full_name,
        parentUrl: gitHubMetadata.parent?.html_url,
      };
    } else if (provider === 'gitlab') {
      const gitLabMetadata = remoteRepoData as GitLabRepositoryMetadata;
      return {
        description: gitLabMetadata.description,
        language: gitLabMetadata.primary_language,
        license: gitLabMetadata.license?.nickname,
        lastUpdated: moment(gitLabMetadata.last_activity_at).fromNow(),
        htmlUrl: gitLabMetadata.web_url,
        parentName: gitLabMetadata.forked_from_project?.full_name,
        parentUrl: gitLabMetadata.forked_from_project?.web_url,
      };
    }
    return {};
  };

  const displayData = getDisplayData();

  const { url: remoteUrl, proxyURL } = props?.data || {};
  const parsedUrl = new URL(remoteUrl);
  const cloneURL = `${proxyURL}/${parsedUrl.host}${parsedUrl.port ? `:${parsedUrl.port}` : ''}${parsedUrl.pathname}`;

  return (
    <TableRow>
      <TableCell>
        <div style={{ padding: '15px' }}>
          <a href={`/dashboard/repo/${props.data?.name}`}>
            <span style={{ fontSize: '17px' }}>
              {props.data.project}/{props.data.name}
            </span>
          </a>
          {displayData.parentName && (
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
                href={displayData.parentUrl}
              >
                {displayData.parentName}
              </a>
            </span>
          )}
          {displayData.description && <p style={{ maxWidth: '80%' }}>{displayData.description}</p>}
          <GridContainer>
            {displayData.language && (
              <GridItem>
                <span
                  style={{
                    height: '12px',
                    width: '12px',
                    backgroundColor: `${languageColors[displayData.language] || '#ccc'}`,
                    borderRadius: '50px',
                    display: 'inline-block',
                    marginRight: '5px',
                  }}
                ></span>
                {displayData.language}
              </GridItem>
            )}
            {displayData.license && (
              <GridItem>
                <LawIcon size='small' />{' '}
                <span style={{ marginLeft: '5px' }}>{displayData.license}</span>
              </GridItem>
            )}
            <GridItem>
              <PeopleIcon size='small' />{' '}
              <span style={{ marginLeft: '5px' }}>{props.data?.users?.canPush?.length || 0}</span>
            </GridItem>
            <GridItem>
              <CodeReviewIcon size='small' />{' '}
              <span style={{ marginLeft: '5px' }}>
                {props.data?.users?.canAuthorise?.length || 0}
              </span>
            </GridItem>
            {displayData.lastUpdated && <GridItem>Last updated {displayData.lastUpdated}</GridItem>}
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
