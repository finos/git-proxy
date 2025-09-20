import { describe, it, beforeEach, expect, vi, type Mock } from 'vitest';
import { PassThrough } from 'stream';

// Mock dependencies first
vi.mock('raw-body', () => ({
  default: vi.fn().mockResolvedValue(Buffer.from('payload')),
}));

vi.mock('../src/proxy/chain', () => ({
  executeChain: vi.fn(),
}));

// must import the module under test AFTER mocks are set
import { teeAndValidate, isPackPost, handleMessage } from '../src/proxy/routes';
import * as rawBody from 'raw-body';
import * as chain from '../src/proxy/chain';

describe('teeAndValidate middleware', () => {
  let req: PassThrough & { method?: string; url?: string; pipe?: (dest: any, opts: any) => void };
  let res: any;
  let next: ReturnType<typeof vi.fn>;

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

    (rawBody.default as Mock).mockClear();
    (chain.executeChain as Mock).mockClear();
  });

  it('skips non-pack posts', async () => {
    req.method = 'GET';
    await teeAndValidate(req as any, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(rawBody.default).not.toHaveBeenCalled();
  });

  it('when the chain blocks it sends a packet and does NOT call next()', async () => {
    (chain.executeChain as Mock).mockResolvedValue({ blocked: true, blockedMessage: 'denied!' });

    req.write('abcd');
    req.end();

    await teeAndValidate(req as any, res, next);

    expect(rawBody.default).toHaveBeenCalledOnce();
    expect(chain.executeChain).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();

    expect(res.set).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(handleMessage('denied!'));
  });

  it('when the chain allows it calls next() and overrides req.pipe', async () => {
    (chain.executeChain as Mock).mockResolvedValue({ blocked: false, error: false });

    req.write('abcd');
    req.end();

    await teeAndValidate(req as any, res, next);

    expect(rawBody.default).toHaveBeenCalledOnce();
    expect(chain.executeChain).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(typeof req.pipe).toBe('function');
  });
});

describe('isPackPost()', () => {
  it('returns true for git-upload-pack POST', () => {
    expect(isPackPost({ method: 'POST', url: '/a/b.git/git-upload-pack' } as any)).toBe(true);
  });

  it('returns true for git-upload-pack POST with multi-level org', () => {
    expect(isPackPost({ method: 'POST', url: '/a/bee/sea/dee.git/git-upload-pack' } as any)).toBe(
      true,
    );
  });

  it('returns true for git-upload-pack POST with bare repo URL', () => {
    expect(isPackPost({ method: 'POST', url: '/a.git/git-upload-pack' } as any)).toBe(true);
  });

  it('returns false for other URLs', () => {
    expect(isPackPost({ method: 'POST', url: '/info/refs' } as any)).toBe(false);
  });
});
