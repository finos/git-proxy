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
import { Request } from 'express';
import { parsePaginationParams } from '../../../src/service/routes/utils';

const makeReq = (query: Record<string, string> = {}): Request => ({ query }) as unknown as Request;

describe('parsePaginationParams', () => {
  describe('defaults', () => {
    it('uses defaultLimit=10 and page=1 when no params', () => {
      const result = parsePaginationParams(makeReq());
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(0);
    });

    it('respects custom defaultLimit', () => {
      const result = parsePaginationParams(makeReq(), 25);
      expect(result.limit).toBe(25);
    });
  });

  describe('limit', () => {
    it('parses limit from query', () => {
      expect(parsePaginationParams(makeReq({ limit: '20' })).limit).toBe(20);
    });

    it('caps limit at 100', () => {
      expect(parsePaginationParams(makeReq({ limit: '999' })).limit).toBe(100);
    });

    it('enforces minimum limit of 1', () => {
      expect(parsePaginationParams(makeReq({ limit: '0' })).limit).toBe(1);
      expect(parsePaginationParams(makeReq({ limit: '-5' })).limit).toBe(1);
    });

    it('falls back to defaultLimit when limit is not a number', () => {
      expect(parsePaginationParams(makeReq({ limit: 'abc' })).limit).toBe(10);
    });
  });

  describe('page and skip', () => {
    it('computes skip from page and limit', () => {
      const result = parsePaginationParams(makeReq({ page: '3', limit: '10' }));
      expect(result.skip).toBe(20);
    });

    it('enforces minimum page of 1', () => {
      const result = parsePaginationParams(makeReq({ page: '0' }));
      expect(result.skip).toBe(0);
    });

    it('falls back to page=1 when page is not a number', () => {
      const result = parsePaginationParams(makeReq({ page: 'abc' }));
      expect(result.skip).toBe(0);
    });
  });

  describe('optional params', () => {
    it('sets search when provided', () => {
      const result = parsePaginationParams(makeReq({ search: 'proxy' }));
      expect(result.search).toBe('proxy');
    });

    it('does not set search when not provided', () => {
      expect(parsePaginationParams(makeReq()).search).toBeUndefined();
    });

    it('sets sortBy when provided', () => {
      expect(parsePaginationParams(makeReq({ sortBy: 'name' })).sortBy).toBe('name');
    });

    it('sets sortOrder to desc when provided', () => {
      expect(parsePaginationParams(makeReq({ sortOrder: 'desc' })).sortOrder).toBe('desc');
    });

    it('defaults sortOrder to asc for any value other than desc', () => {
      expect(parsePaginationParams(makeReq({ sortOrder: 'random' })).sortOrder).toBe('asc');
    });

    it('does not set sortOrder when not provided', () => {
      expect(parsePaginationParams(makeReq()).sortOrder).toBeUndefined();
    });
  });
});
