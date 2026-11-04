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
  levenshtein,
  nearestPopular,
  nearestPopularPython,
} from '../../../plugins/git-proxy-plugin-supply-chain/lib/typosquat.js';
import { nearestPopularGo } from '../../../plugins/git-proxy-plugin-supply-chain/lib/ecosystems/go.js';

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('express', 'express')).toBe(0);
    expect(levenshtein('expresss', 'express')).toBe(1);
    expect(levenshtein('lodahs', 'lodash')).toBe(2);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('nearestPopular', () => {
  it('flags a one-edit typosquat', () => {
    expect(nearestPopular('expresss')).toBe('express');
    expect(nearestPopular('reqeust')).toBe('request');
  });

  it('does not flag exact popular names', () => {
    expect(nearestPopular('express')).toBeNull();
    expect(nearestPopular('react')).toBeNull();
  });

  it('unscopes before comparing', () => {
    // exact popular name under a foreign scope is not a typo (handled separately)
    expect(nearestPopular('@acme/express')).toBeNull();
    // a typo under a scope is still flagged
    expect(nearestPopular('@acme/expresss')).toBe('express');
  });

  it('ignores very short names to avoid noise', () => {
    expect(nearestPopular('ab')).toBeNull();
    expect(nearestPopular('pg')).toBeNull();
  });

  it('honours the allow list', () => {
    expect(nearestPopular('expresss', ['expresss'])).toBeNull();
  });

  it('does not flag clearly-distinct names', () => {
    expect(nearestPopular('acme-internal-widget')).toBeNull();
  });
});

describe('nearestPopularPython', () => {
  it('flags a PyPI typosquat and ignores exact/unique names', () => {
    expect(nearestPopularPython('requsts')).toBe('requests');
    expect(nearestPopularPython('requests')).toBeNull();
    expect(nearestPopularPython('acme-internal-service')).toBeNull();
  });
});

describe('nearestPopularGo', () => {
  it('does not flag exact popular Go module paths', () => {
    expect(nearestPopularGo('github.com/stretchr/testify')).toBeNull();
  });

  it('strips semantic import version suffixes before comparing', () => {
    expect(nearestPopularGo('github.com/golang-jwt/jwt/v5')).toBeNull();
  });

  it('strips gopkg.in dotted version suffixes before comparing', () => {
    expect(nearestPopularGo('gopkg.in/yaml.v3')).toBeNull();
  });

  it('flags host typos against popular Go modules', () => {
    expect(nearestPopularGo('githib.com/stretchr/testify')).toBe('github.com/stretchr/testify');
  });

  it('flags tail typos against popular Go modules', () => {
    expect(nearestPopularGo('github.com/strechr/testify')).toBe('github.com/stretchr/testify');
  });

  it('honours the allow list for full module paths', () => {
    expect(
      nearestPopularGo('github.com/strechr/testify', ['github.com/strechr/testify']),
    ).toBeNull();
  });

  it('does not flag distinct internal module paths', () => {
    expect(nearestPopularGo('git.corp.example/team/lib')).toBeNull();
  });
});
