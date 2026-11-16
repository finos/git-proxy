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

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Button, Dialog, FormControl, IconButton, Stack, TextInput } from '@primer/react';
import type { DialogHeaderProps } from '@primer/react';
import { RepoIcon, XIcon } from '@primer/octicons-react';
import Warning from '../../../components/Warning/Warning';
import { addRepo } from '../../../services/repo';
import { RepoView } from '../../../types';
import { isGitHubGitRemoteUrl, parseGitRemoteUrl } from '../../../utils/parseGitRemoteUrl';

interface AddRepositoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (repo: RepoView) => void | Promise<void>;
}

interface NewRepoProps {
  onSuccess: (repo: RepoView) => Promise<void>;
}

const FORM_ID = 'add-repo-form';

function canSubmitAddRepo(project: string, name: string, url: string): boolean {
  const p = project.trim();
  const n = name.trim();
  const u = url.trim();
  if (p.length === 0 || p.length > 100) return false;
  if (n.length === 0 || n.length > 100) return false;
  try {
    const parsedUrl = new URL(u);
    if (!parsedUrl.pathname.endsWith('.git')) return false;
  } catch {
    return false;
  }
  return true;
}

const AddRepositoryDialogHeader = ({
  dialogLabelId,
  title,
  subtitle,
  dialogDescriptionId,
  onClose,
}: DialogHeaderProps) => (
  <Dialog.Header>
    <div className='flex'>
      <div className='flex min-w-0 flex-1 flex-col px-2 py-1.5'>
        <Dialog.Title id={dialogLabelId}>{title ?? 'Dialog'}</Dialog.Title>
        {subtitle ? <Dialog.Subtitle id={dialogDescriptionId}>{subtitle}</Dialog.Subtitle> : null}
      </div>
      <IconButton
        icon={XIcon}
        aria-label='Close'
        variant='invisible'
        onClick={() => onClose('close-button')}
        unsafeDisableTooltip
      />
    </div>
  </Dialog.Header>
);

const AddRepositoryDialog = ({ open, onClose, onSuccess }: AddRepositoryDialogProps) => {
  const [project, setProject] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const resetRepo = useCallback(() => {
    setProject('');
    setName('');
    setUrl('');
  }, []);

  const handleDialogClose = useCallback(
    (_gesture: 'close-button' | 'escape') => {
      setError('');
      resetRepo();
      onClose();
    },
    [onClose, resetRepo],
  );

  const add = async (): Promise<void> => {
    const repo: RepoView = {
      project: project.trim(),
      name: name.trim(),
      url: url.trim(),
      proxyURL: '',
      users: { canPush: [], canAuthorise: [] },
    };

    if (repo.project.length === 0 || repo.project.length > 100) {
      setError('Project name length must be between 1 and 100 characters');
      return;
    }

    if (repo.name.length === 0 || repo.name.length > 100) {
      setError('Repository name length must be between 1 and 100 characters');
      return;
    }

    try {
      const parsedUrl = new URL(repo.url);
      if (!parsedUrl.pathname.endsWith('.git')) {
        setError('Invalid git URL - Git URLs should end with .git');
        return;
      }
    } catch {
      setError('Invalid URL format');
      return;
    }

    const result = await addRepo(repo);
    if (result.success && result.data) {
      await onSuccess(result.data);
      setError('');
      resetRepo();
      onClose();
    } else {
      setError(result.message || 'Failed to add repository');
    }
  };

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setUrl(next);
    const parsed = parseGitRemoteUrl(next);
    if (parsed && isGitHubGitRemoteUrl(next)) {
      setProject((p) => (p.trim() ? p : parsed.project));
      setName((n) => (n.trim() ? n : parsed.name));
    }
  }, []);

  return open ? (
    <Dialog
      title='Add a repository'
      subtitle='Organization, repository name, and Git remote URL.'
      onClose={handleDialogClose}
      renderHeader={AddRepositoryDialogHeader}
      width='large'
      height='auto'
      data-testid='add-repo-dialog'
    >
      <Dialog.Body>
        <form
          id={FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          className='flex flex-col gap-4'
        >
          <Warning message={error} data-testid='repo-error' />
          <Stack direction='vertical' gap='normal' padding='none'>
            <FormControl>
              <FormControl.Label htmlFor='project'>Organization</FormControl.Label>
              <TextInput
                id='project'
                name='project'
                value={project}
                maxLength={200}
                autoComplete='organization'
                block
                data-testid='repo-project-input'
                onChange={(e) => setProject(e.target.value)}
                aria-describedby='project-caption'
              />
              <FormControl.Caption id='project-caption'>
                Organization or path, e.g. finos
              </FormControl.Caption>
            </FormControl>
            <FormControl>
              <FormControl.Label htmlFor='name'>Name</FormControl.Label>
              <TextInput
                id='name'
                name='name'
                value={name}
                maxLength={200}
                autoComplete='off'
                block
                data-testid='repo-name-input'
                onChange={(e) => setName(e.target.value)}
                aria-describedby='name-caption'
              />
              <FormControl.Caption id='name-caption'>
                Repository Name, e.g. git-proxy
              </FormControl.Caption>
            </FormControl>
            <FormControl>
              <FormControl.Label htmlFor='url'>URL</FormControl.Label>
              <TextInput
                id='url'
                name='url'
                type='url'
                value={url}
                maxLength={200}
                autoComplete='off'
                block
                data-testid='repo-url-input'
                onChange={handleUrlChange}
                aria-describedby='url-caption'
              />
              <FormControl.Caption id='url-caption'>
                Git Repository URL, e.g. https://github.com/finos/git-proxy.git
              </FormControl.Caption>
            </FormControl>
          </Stack>
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <div className='flex w-full justify-end gap-2'>
          <Button type='button' onClick={() => handleDialogClose('close-button')}>
            Cancel
          </Button>
          <Button
            type='submit'
            form={FORM_ID}
            variant='primary'
            data-testid='add-repo-submit'
            disabled={!canSubmitAddRepo(project, name, url)}
          >
            Add
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog>
  ) : null;
};

const NewRepo = ({ onSuccess }: NewRepoProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSuccess = useCallback(
    async (repo: RepoView) => {
      await onSuccess(repo);
      if (repo._id) {
        navigate(`/dashboard/repo/${repo._id}`);
      }
    },
    [navigate, onSuccess],
  );

  return (
    <div>
      <Button
        variant='primary'
        leadingVisual={RepoIcon}
        onClick={handleClickOpen}
        data-testid='add-repo-button'
      >
        New
      </Button>
      <AddRepositoryDialog open={open} onClose={handleClose} onSuccess={handleSuccess} />
    </div>
  );
};

export default NewRepo;
