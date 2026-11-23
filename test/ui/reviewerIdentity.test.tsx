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

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import ReviewerIdentity from '../../src/ui/components/ReviewerIdentity/ReviewerIdentity';

vi.mock('@primer/react', async () => {
  const { createElement } = await import('react');
  const Text = ({ children, title }: { children?: React.ReactNode; title?: string }) =>
    createElement('span', { title }, children);
  const Link = ({ children, href }: { children?: React.ReactNode; href?: string }) =>
    createElement('a', { href }, children);
  return { Text, Link };
});
vi.mock('../../src/ui/query/useDisplayNameQuery', () => ({
  useDisplayNameQuery: () => ({ data: null }),
}));
vi.mock('../../src/ui/query/useUsernameByEmailQuery', () => ({
  useUsernameByEmailQuery: () => ({ data: null }),
}));

const render = (reviewer?: Parameters<typeof ReviewerIdentity>[0]['reviewer']) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ReviewerIdentity reviewer={reviewer} />
    </MemoryRouter>,
  );

describe('ReviewerIdentity', () => {
  it('shows display name and email', () => {
    const html = render({ username: 'bob', displayName: 'Bob Smith', email: 'bob@example.com' });
    expect(html).toContain('Bob Smith');
    expect(html).toContain('bob@example.com');
    expect(html).toContain('title="Bob Smith &lt;bob@example.com&gt;"');
  });

  it('reads reviewerEmail as used by approval records', () => {
    const html = render({ username: 'bob', displayName: 'Bob Smith', reviewerEmail: 'bob@x.io' });
    expect(html).toContain('bob@x.io');
  });

  it('derives a name from the email when displayName is missing', () => {
    const html = render({ username: 'jane', reviewerEmail: 'jane.doe@x.io' });
    expect(html).toContain('Jane Doe');
    expect(html).toContain('jane.doe@x.io');
  });

  it('falls back to the username when there is no name or email', () => {
    const html = render({ username: 'carol' });
    expect(html).toContain('carol');
  });

  it('renders a dash with no reviewer', () => {
    expect(render(undefined)).toContain('—');
  });
});
