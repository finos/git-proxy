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

import { describe, it, expect } from 'vitest';
import {
  trimPrefixRefsHeads,
  trimTrailingDotGit,
  buildSearchFilter,
  buildSort,
} from '../src/db/helper';

describe('db helpers', () => {
  describe('buildSearchFilter', () => {
    it('returns baseQuery unchanged when search is not provided', () => {
      const base = { project: 'myproject' };
      expect(buildSearchFilter(base, ['name', 'url'])).toEqual(base);
    });

    it('returns baseQuery unchanged when search is empty string', () => {
      const base = { project: 'myproject' };
      expect(buildSearchFilter(base, ['name', 'url'], '')).toEqual(base);
    });

    it('adds $or clause for each search field', () => {
      const result = buildSearchFilter({}, ['name', 'url'], 'proxy');
      expect(result.$or).toHaveLength(2);
      expect((result.$or as any[])[0]).toHaveProperty('name');
      expect((result.$or as any[])[1]).toHaveProperty('url');
    });

    it('merges baseQuery with $or clause', () => {
      const result = buildSearchFilter({ project: 'myproject' }, ['name'], 'proxy');
      expect(result.project).toBe('myproject');
      expect(result.$or).toBeDefined();
    });

    it('creates case-insensitive regex', () => {
      const result = buildSearchFilter({}, ['name'], 'Proxy');
      const regex = (result.$or as any[])[0].name as RegExp;
      expect(regex.flags).toContain('i');
      expect(regex.test('git-proxy')).toBe(true);
      expect(regex.test('GIT-PROXY')).toBe(true);
    });

    it('escapes special regex characters in search term', () => {
      const result = buildSearchFilter({}, ['name'], 'git.proxy');
      const regex = (result.$or as any[])[0].name as RegExp;
      expect(regex.test('gitXproxy')).toBe(false);
      expect(regex.test('git.proxy')).toBe(true);
    });
  });

  describe('buildSort', () => {
    it('uses default field and direction when no pagination provided', () => {
      expect(buildSort(undefined, 'name', 1)).toEqual({ name: 1 });
    });

    it('uses default field and direction when sortBy/sortOrder not set', () => {
      expect(buildSort({ skip: 0, limit: 10 }, 'timestamp', -1)).toEqual({ timestamp: -1 });
    });

    it('uses sortBy field from pagination', () => {
      expect(buildSort({ skip: 0, limit: 10, sortBy: 'email' }, 'name', 1)).toEqual({ email: 1 });
    });

    it('applies asc direction', () => {
      expect(buildSort({ skip: 0, limit: 10, sortOrder: 'asc' }, 'name', -1)).toEqual({ name: 1 });
    });

    it('applies desc direction', () => {
      expect(buildSort({ skip: 0, limit: 10, sortOrder: 'desc' }, 'name', 1)).toEqual({ name: -1 });
    });

    it('applies both sortBy and sortOrder', () => {
      expect(
        buildSort({ skip: 0, limit: 10, sortBy: 'email', sortOrder: 'desc' }, 'name', 1),
      ).toEqual({ email: -1 });
    });
  });

  describe('trimPrefixRefsHeads', () => {
    it('removes `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/test');
      expect(res).toBe('test');
    });

    it('removes only one `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/refs/heads/');
      expect(res).toBe('refs/heads/');
    });

    it('removes only the first `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/middle/refs/heads/end/refs/heads/');
      expect(res).toBe('middle/refs/heads/end/refs/heads/');
    });

    it('handles empty string', () => {
      const res = trimPrefixRefsHeads('');
      expect(res).toBe('');
    });

    it("doesn't remove `refs/heads`", () => {
      const res = trimPrefixRefsHeads('refs/headstest');
      expect(res).toBe('refs/headstest');
    });

    it("doesn't remove `/refs/heads/`", () => {
      const res = trimPrefixRefsHeads('/refs/heads/test');
      expect(res).toBe('/refs/heads/test');
    });
  });

  describe('trimTrailingDotGit', () => {
    it('removes `.git`', () => {
      const res = trimTrailingDotGit('test.git');
      expect(res).toBe('test');
    });

    it('removes only one `.git`', () => {
      const res = trimTrailingDotGit('.git.git');
      expect(res).toBe('.git');
    });

    it('removes only the last `.git`', () => {
      const res = trimTrailingDotGit('.git-middle.git-end.git');
      expect(res).toBe('.git-middle.git-end');
    });

    it('handles empty string', () => {
      const res = trimTrailingDotGit('');
      expect(res).toBe('');
    });

    it("doesn't remove just `git`", () => {
      const res = trimTrailingDotGit('testgit');
      expect(res).toBe('testgit');
    });
  });
});
