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
import { Link, MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserIdentity, { UserIdentityProps } from '../../src/ui/components/UserIdentity/UserIdentity';
import { useDisplayNameQuery } from '../../src/ui/query/useDisplayNameQuery';
import { useUsernameByEmailQuery } from '../../src/ui/query/useUsernameByEmailQuery';

vi.mock('../../src/ui/query/useDisplayNameQuery', () => ({
  useDisplayNameQuery: vi.fn(),
}));

vi.mock('../../src/ui/query/useUsernameByEmailQuery', () => ({
  useUsernameByEmailQuery: vi.fn(),
}));

const displayNameMock = useDisplayNameQuery as ReturnType<typeof vi.fn>;
const usernameByEmailMock = useUsernameByEmailQuery as ReturnType<typeof vi.fn>;

function renderIdentity(props: UserIdentityProps) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <UserIdentity {...props} />
    </MemoryRouter>,
  );
}

describe('UserIdentity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    displayNameMock.mockReturnValue({ data: null });
    usernameByEmailMock.mockReturnValue({ data: null });
  });

  it('links a matched author using a normalized email lookup and preserves styling', () => {
    usernameByEmailMock.mockReturnValue({ data: 'alice' });

    const markup = renderIdentity({
      name: ' Alice Author ',
      email: ' Alice@Example.com ',
      title: 'Author identity',
      className: 'identity',
      nameClassName: 'name',
      emailClassName: 'email',
    });

    expect(usernameByEmailMock).toHaveBeenCalledWith('alice@example.com');
    expect(displayNameMock).toHaveBeenCalledWith(undefined);
    expect(markup).toContain('<span class="identity">');
    expect(markup).toContain('href="/dashboard/user/alice"');
    expect(markup).toContain('class="name" title="Author identity"');
    expect(markup).toContain('>Alice Author</a>');
    expect(markup).toContain('<span class="email">Alice@Example.com</span>');
  });

  it('renders an unmatched identity without a profile link', () => {
    const markup = renderIdentity({ name: 'Unknown Author', email: 'unknown@example.com' });

    expect(markup).toBe('<span><span>Unknown Author</span><span>unknown@example.com</span></span>');
    expect(usernameByEmailMock).toHaveBeenCalledWith('unknown@example.com');
  });

  it('prefers an explicit username and name without either lookup', () => {
    usernameByEmailMock.mockReturnValue({ data: 'other-user' });
    displayNameMock.mockReturnValue({ data: 'Other Name' });

    const markup = renderIdentity({
      username: ' alice ',
      name: ' Alice Author ',
      email: 'alice@example.com',
    });

    expect(markup).toContain('href="/dashboard/user/alice"');
    expect(markup).toContain('>Alice Author</a>');
    expect(usernameByEmailMock).toHaveBeenCalledWith(undefined);
    expect(displayNameMock).toHaveBeenCalledWith(undefined);
  });

  it('uses the resolved display name when an explicit username has no name', () => {
    displayNameMock.mockReturnValue({ data: 'Alice Example' });

    const markup = renderIdentity({ username: ' alice ', name: '  ' });

    expect(markup).toContain('href="/dashboard/user/alice"');
    expect(markup).toContain('>Alice Example</a>');
    expect(displayNameMock).toHaveBeenCalledWith('alice');
    expect(usernameByEmailMock).toHaveBeenCalledWith(undefined);
  });

  it.each([undefined, null, ''])('falls back to the username for display name %s', (data) => {
    displayNameMock.mockReturnValue({ data });

    expect(renderIdentity({ username: ' alice ' })).toContain('>alice</a>');
  });

  it.each([{}, { username: '  ', name: '\t', email: ' \n ' }])(
    'renders the empty placeholder and disables lookups for %j',
    (props) => {
      expect(renderIdentity({ ...props, emptyClassName: 'empty' })).toBe(
        '<span class="empty">—</span>',
      );
      expect(usernameByEmailMock).toHaveBeenCalledWith(undefined);
      expect(displayNameMock).toHaveBeenCalledWith(undefined);
    },
  );

  it('renders an email-only identity without inventing a display name or link', () => {
    usernameByEmailMock.mockReturnValue({ data: 'alice' });

    expect(renderIdentity({ email: ' alice@example.com ', emailClassName: 'email' })).toBe(
      '<span><span class="email">alice@example.com</span></span>',
    );
    expect(displayNameMock).toHaveBeenCalledWith(undefined);
  });

  it('renders a name-only identity without lookups', () => {
    expect(renderIdentity({ name: ' Alice ' })).toBe('<span><span>Alice</span></span>');
    expect(usernameByEmailMock).toHaveBeenCalledWith(undefined);
    expect(displayNameMock).toHaveBeenCalledWith(undefined);
  });

  it('encodes explicit usernames in profile URLs', () => {
    expect(renderIdentity({ username: ' alice/team +?# ' })).toContain(
      'href="/dashboard/user/alice%2Fteam%20%2B%3F%23"',
    );
  });

  it('encodes email-matched usernames in profile URLs', () => {
    usernameByEmailMock.mockReturnValue({ data: 'alice/team +?#' });

    expect(renderIdentity({ name: 'Alice', email: 'alice@example.com' })).toContain(
      'href="/dashboard/user/alice%2Fteam%20%2B%3F%23"',
    );
  });

  it('stops profile link clicks from propagating to the containing row', () => {
    const identity = UserIdentity({ username: 'alice' });
    const children = React.Children.toArray(
      (identity.props as { children: React.ReactNode }).children,
    );
    const link = children.find(
      (child) => React.isValidElement(child) && child.type === Link,
    ) as React.ReactElement<{ onClick: (event: React.MouseEvent) => void }>;
    const stopPropagation = vi.fn();

    expect(link).toBeDefined();
    link.props.onClick({ stopPropagation } as unknown as React.MouseEvent);

    expect(stopPropagation).toHaveBeenCalledOnce();
  });
});
