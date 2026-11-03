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
import { hostMatchesNoProxy } from '../src/proxy/routes';

describe('hostMatchesNoProxy', () => {
  describe('null / undefined / empty host', () => {
    it('returns false for null host', () => {
      expect(hostMatchesNoProxy(null, ['example.com'])).toBe(false);
    });

    it('returns false for undefined host', () => {
      expect(hostMatchesNoProxy(undefined, ['example.com'])).toBe(false);
    });

    it('returns false for empty string host', () => {
      expect(hostMatchesNoProxy('', ['example.com'])).toBe(false);
    });
  });

  describe('empty noProxyList', () => {
    it('returns false when list is empty', () => {
      expect(hostMatchesNoProxy('github.com', [])).toBe(false);
    });
  });

  describe('exact match', () => {
    it('matches host exactly', () => {
      expect(hostMatchesNoProxy('github.com', ['github.com'])).toBe(true);
    });

    it('does not match a different host', () => {
      expect(hostMatchesNoProxy('gitlab.com', ['github.com'])).toBe(false);
    });

    it('strips port before matching', () => {
      expect(hostMatchesNoProxy('github.com:443', ['github.com'])).toBe(true);
    });

    it('does not match a subdomain as exact', () => {
      expect(hostMatchesNoProxy('api.github.com', ['github.com'])).toBe(true); // suffix match applies
    });
  });

  describe('domain suffix match', () => {
    it('matches subdomain when pattern is the parent domain', () => {
      expect(hostMatchesNoProxy('api.github.com', ['github.com'])).toBe(true);
    });

    it('matches deeply nested subdomain', () => {
      expect(hostMatchesNoProxy('foo.bar.corp.local', ['corp.local'])).toBe(true);
    });

    it('does not match unrelated domain that happens to end with same string', () => {
      expect(hostMatchesNoProxy('notgithub.com', ['github.com'])).toBe(false);
    });
  });

  describe('leading dot in pattern', () => {
    it('strips leading dot and still matches subdomain', () => {
      expect(hostMatchesNoProxy('api.github.com', ['.github.com'])).toBe(true);
    });

    it('strips leading dot and still matches exact host', () => {
      expect(hostMatchesNoProxy('github.com', ['.github.com'])).toBe(true);
    });
  });

  describe('wildcard pattern', () => {
    it('matches any host when pattern is *', () => {
      expect(hostMatchesNoProxy('anything.example.com', ['*'])).toBe(true);
    });

    it('matches bare hostname when pattern is *', () => {
      expect(hostMatchesNoProxy('localhost', ['*'])).toBe(true);
    });
  });

  describe('blank / whitespace patterns', () => {
    it('ignores empty string pattern', () => {
      expect(hostMatchesNoProxy('github.com', [''])).toBe(false);
    });

    it('ignores whitespace-only pattern', () => {
      expect(hostMatchesNoProxy('github.com', ['   '])).toBe(false);
    });
  });

  describe('multiple patterns', () => {
    it('returns true when host matches any pattern in the list', () => {
      expect(hostMatchesNoProxy('github.com', ['gitlab.com', 'github.com', 'bitbucket.org'])).toBe(
        true,
      );
    });

    it('returns false when host matches none of the patterns', () => {
      expect(hostMatchesNoProxy('github.com', ['gitlab.com', 'bitbucket.org'])).toBe(false);
    });
  });
});
