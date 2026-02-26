import React, { useEffect } from 'react';
import { Snackbar, TableCell, TableRow } from '@material-ui/core';
import GridContainer from '../../../components/Grid/GridContainer';
import GridItem from '../../../components/Grid/GridItem';
import { CodeReviewIcon, LawIcon, PeopleIcon } from '@primer/octicons-react';
import CodeActionButton from '../../../components/CustomButtons/CodeActionButton';
import { languageColors } from '../../../../constants/languageColors';
import { RepoView, SCMRepositoryMetadata } from '../../../types';
import { fetchRemoteRepositoryData } from '../../../utils';

export interface RepositoriesProps {
  repo: RepoView;
  [key: string]: unknown;
}

const Repositories: React.FC<RepositoriesProps> = (props) => {
  const [remoteRepoData, setRemoteRepoData] = React.useState<SCMRepositoryMetadata | null>(null);
  const [errorMessage] = React.useState('');
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);

  useEffect(() => {
    prepareRemoteRepositoryData();
  }, [props.repo.project, props.repo.name, props.repo.url]);

  const prepareRemoteRepositoryData = async () => {
    try {
      const { url: remoteUrl } = props.repo;
      if (!remoteUrl) return;

      setRemoteRepoData(
        await fetchRemoteRepositoryData(props.repo.project, props.repo.name, remoteUrl),
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const errorMessage = `Unable to fetch repository data for ${props.repo.project}/${props.repo.name} from '${remoteUrl}' - this may occur if the project is private or from an SCM vendor that is not supported.`;
      console.warn(errorMessage, msg);
    }
  };

  const { url: remoteUrl, proxyURL } = props?.repo || {};
  const parsedUrl = new URL(remoteUrl);
  const cloneURL = `${proxyURL}/${parsedUrl.host}${parsedUrl.port ? `:${parsedUrl.port}` : ''}${parsedUrl.pathname}`;

  return (
    <TableRow>
      <TableCell>
        <div style={{ padding: '15px' }}>
          <a href={`/dashboard/repo/${props.repo._id}`}>
            <span style={{ fontSize: '17px' }}>
              {props.repo.project}/{props.repo.name}
            </span>
          </a>
          {remoteRepoData?.parentName && (
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
                href={remoteRepoData.parentUrl}
              >
                {remoteRepoData.parentName}
              </a>
            </span>
          )}
          {remoteRepoData?.description && (
            <p style={{ maxWidth: '80%' }}>{remoteRepoData.description}</p>
          )}
          <GridContainer>
            {remoteRepoData?.language && (
              <GridItem>
                <span
                  style={{
                    height: '12px',
                    width: '12px',
                    backgroundColor: `${languageColors[remoteRepoData.language] || '#ccc'}`,
                    borderRadius: '50px',
                    display: 'inline-block',
                    marginRight: '5px',
                  }}
                ></span>
                {remoteRepoData.language}
              </GridItem>
            )}
            {remoteRepoData?.license && (
              <GridItem>
                <LawIcon size='small' />{' '}
                <span style={{ marginLeft: '5px' }}>{remoteRepoData.license}</span>
              </GridItem>
            )}
            <GridItem>
              <PeopleIcon size='small' />{' '}
              <span style={{ marginLeft: '5px' }}>{props.repo?.users?.canPush?.length || 0}</span>
            </GridItem>
            <GridItem>
              <CodeReviewIcon size='small' />{' '}
              <span style={{ marginLeft: '5px' }}>
                {props.repo?.users?.canAuthorise?.length || 0}
              </span>
            </GridItem>
            {remoteRepoData?.lastUpdated && (
              <GridItem>Last updated {remoteRepoData.lastUpdated}</GridItem>
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
