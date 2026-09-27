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

import React, { useEffect, useState } from 'react';
import { Button, FormControl, Stack, Text, TextInput } from '@primer/react';

import Danger from '../../../components/Typography/Danger';
import { getScmProviders, setScmIdentity, ScmProviderSummary } from '../../../services/scm';

interface LinkedAccountsProps {
  username: string;
  identities: Record<string, string>;
  isOwnProfile: boolean;
  onChange: (identities: Record<string, string>) => void;
}

/**
 * One row per configured SCM provider: the account handle the user holds
 * there, editable. A push is attributed to this user when the credential it
 * carries resolves, through the provider's API, to one of these handles.
 */
export default function LinkedAccounts({
  username,
  identities,
  isOwnProfile,
  onChange,
}: LinkedAccountsProps): React.ReactElement {
  const [providers, setProviders] = useState<ScmProviderSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getScmProviders()
      .then(setProviders)
      .catch(() => setError('Failed to load SCM providers.'));
  }, []);

  useEffect(() => {
    setDrafts({ ...identities });
  }, [identities]);

  const save = async (provider: string, login: string | null) => {
    setBusy(provider);
    setError('');
    try {
      await setScmIdentity(username, provider, login);
      const next = { ...identities };
      if (login) next[provider] = login.trim().toLowerCase();
      else delete next[provider];
      onChange(next);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to update linked account.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack direction='vertical' gap='normal' padding='none' className='min-w-0'>
      <Stack direction='vertical' gap='condensed' padding='none'>
        <Text className='text-sm font-semibold'>Linked accounts</Text>
        <Text className='text-sm text-(--fgColor-muted)'>
          {isOwnProfile
            ? 'Pushes are attributed to you when the token you push with belongs to one of these accounts.'
            : 'Pushes are attributed to this user when the token they push with belongs to one of these accounts.'}
        </Text>
      </Stack>
      {error ? <Danger>{error}</Danger> : null}
      {providers.length === 0 && !error ? (
        <Text className='text-sm text-(--fgColor-muted)'>No SCM providers are configured.</Text>
      ) : null}
      {providers.map((provider) => {
        const linked = identities[provider.name] ?? '';
        const draft = drafts[provider.name] ?? '';
        const unchanged = draft.trim().toLowerCase() === linked;
        return (
          <FormControl key={provider.name}>
            <FormControl.Label>{provider.name}</FormControl.Label>
            <Stack direction='horizontal' gap='condensed' padding='none' align='center'>
              <TextInput
                placeholder={`Account on ${provider.host}`}
                value={draft}
                onChange={(e) => setDrafts({ ...drafts, [provider.name]: e.target.value })}
                disabled={busy !== null}
                block
              />
              <Button
                onClick={() => save(provider.name, draft.trim() || null)}
                disabled={busy !== null || unchanged || (!draft.trim() && !linked)}
              >
                {draft.trim() ? 'Save' : 'Unlink'}
              </Button>
            </Stack>
            <FormControl.Caption>
              {provider.host}
              {linked ? ` · linked as ${linked}` : ' · not linked'}
            </FormControl.Caption>
          </FormControl>
        );
      })}
    </Stack>
  );
}
