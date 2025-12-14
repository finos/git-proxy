import { Request } from 'express';
import rawBody from 'raw-body';
import { PassThrough } from 'stream';
import { describe, it, beforeEach, expect, vi, Mock, afterAll } from 'vitest';

// Tell Vitest to mock dependencies
vi.mock('raw-body', () => ({
  default: vi.fn().mockResolvedValue(Buffer.from('payload')),
}));

vi.mock('../src/proxy/chain', () => ({
  executeChain: vi.fn(),
}));

// Now import the module-under-test, which will receive the mocked deps
import { extractRawBody, isPackPost } from '../src/proxy/routes';
import * as chain from '../src/proxy/chain';

describe('extractRawBody middleware', () => {
  let req: any;
  let res: any;
  let next: Mock;

  beforeEach(() => {
    req = new PassThrough();
    req.method = 'POST';
    req.url = '/proj/foo.git/git-upload-pack';

    res = {
      set: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      end: vi.fn(),
    };

    next = vi.fn();
  });

  afterAll(() => {
    (rawBody as Mock).mockClear();
    (chain.executeChain as Mock).mockClear();
  });

  it('skips non-pack posts', async () => {
    req.method = 'GET';
    await extractRawBody(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(rawBody).not.toHaveBeenCalled();
  });

  it('extracts raw body and sets bodyRaw property', async () => {
    req.write('abcd');
    req.end();

    await extractRawBody(req, res, next);

    expect(rawBody).toHaveBeenCalledOnce();
    expect(chain.executeChain).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(req.bodyRaw).toBeDefined();
    expect(typeof req.pipe).toBe('function');
  });
});

describe('isPackPost()', () => {
  it('returns true for git-upload-pack POST', () => {
    expect(isPackPost({ method: 'POST', url: '/a/b.git/git-upload-pack' } as Request)).toBe(true);
  });

  it('returns true for git-upload-pack POST, with a gitlab style multi-level org', () => {
    expect(
      isPackPost({ method: 'POST', url: '/a/bee/sea/dee.git/git-upload-pack' } as Request),
    ).toBe(true);
  });

  it('returns true for git-upload-pack POST, with a bare (no org) repo URL', () => {
    expect(isPackPost({ method: 'POST', url: '/a.git/git-upload-pack' } as Request)).toBe(true);
  });

  it('returns false for other URLs', () => {
    expect(isPackPost({ method: 'POST', url: '/info/refs' } as Request)).toBe(false);
  });
});
