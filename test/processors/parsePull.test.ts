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
import { deflateSync, gzipSync } from 'zlib';
import { Action, PullType, RequestType } from '../../src/proxy/actions';
import { exec, tokenizePktLines } from '../../src/proxy/processors/pre-processor/parsePull';

const OID1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OID2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const OID3 = 'cccccccccccccccccccccccccccccccccccccccc';

const pkt = (line: string): Buffer => {
  const payload = Buffer.from(`${line}\n`, 'utf8');
  const length = (payload.length + 4).toString(16).padStart(4, '0');
  return Buffer.concat([Buffer.from(length, 'utf8'), payload]);
};
const FLUSH = Buffer.from('0000', 'utf8');
const DELIM = Buffer.from('0001', 'utf8');
const END = Buffer.from('0002', 'utf8');

const bodyOf = (...parts: Buffer[]) => Buffer.concat(parts);

const makeAction = (): Action =>
  new Action(
    'action-1',
    RequestType.PULL,
    'POST',
    Date.now(),
    'https://github.com/example/repo.git',
  );

const makeReq = (body: unknown, headers: Request['headers'] = {}): Request =>
  ({ headers, body }) as Request;

const v1FetchBody = () =>
  bodyOf(
    pkt(`want ${OID1} multi_ack thin-pack`),
    pkt(`want ${OID2}`),
    FLUSH,
    pkt(`have ${OID3}`),
    pkt('done'),
    FLUSH,
  );

const v2FetchBody = () =>
  bodyOf(
    pkt('command=fetch'),
    pkt('agent=git/2.45.0'),
    pkt('object-format=sha1'),
    DELIM,
    pkt(`want ${OID1}`),
    pkt(`have ${OID2}`),
    pkt('done'),
    FLUSH,
  );

describe('tokenizePktLines', () => {
  it('throws if input is not a Buffer', () => {
    expect(() => tokenizePktLines('not a buffer' as unknown as Buffer)).toThrow(
      'tokenizePktLines expected a Buffer',
    );
  });

  it('returns an empty array for an empty buffer', () => {
    expect(tokenizePktLines(Buffer.alloc(0))).toEqual([]);
  });

  it('tokenizes a data packet and strips the trailing newline', () => {
    expect(tokenizePktLines(pkt(`want ${OID1}`))).toEqual([{ kind: 'data', line: `want ${OID1}` }]);
  });

  it('maps flush, delim, and end packets', () => {
    expect(tokenizePktLines(bodyOf(FLUSH, DELIM, END))).toEqual([
      { kind: 'flush' },
      { kind: 'delim' },
      { kind: 'end' },
    ]);
  });

  it('throws on length 0003', () => {
    expect(() => tokenizePktLines(Buffer.from('0003', 'utf8'))).toThrow(
      'Invalid packet line length 0003 at offset 0',
    );
  });

  it('throws on a non-hex length prefix', () => {
    expect(() => tokenizePktLines(Buffer.from('zzzz', 'utf8'))).toThrow(
      'Invalid packet line length zzzz at offset 0',
    );
  });

  it('throws when a packet is truncated', () => {
    expect(() => tokenizePktLines(Buffer.from('0010ab', 'utf8'))).toThrow(
      'Invalid packet line length 0010 at offset 0',
    );
  });

  it('silently ignores trailing incomplete bytes', () => {
    expect(tokenizePktLines(bodyOf(pkt(`want ${OID1}`), Buffer.from('00', 'utf8')))).toEqual([
      { kind: 'data', line: `want ${OID1}` },
    ]);
  });

  it('tokenizes a mixed stream of data, flush, and data', () => {
    expect(tokenizePktLines(bodyOf(pkt(`want ${OID1}`), FLUSH, pkt(`have ${OID2}`)))).toEqual([
      { kind: 'data', line: `want ${OID1}` },
      { kind: 'flush' },
      { kind: 'data', line: `have ${OID2}` },
    ]);
  });
});

describe('parsePull exec', () => {
  describe('protocol v1', () => {
    it('parses a v1 fetch with capabilities on the first want', async () => {
      const action = makeAction();
      const result = await exec(makeReq(v1FetchBody()), action);

      expect(result).toBe(action);
      expect(action.error).toBe(false);
      expect(action.steps[0].stepName).toBe('parsePull');
      expect(action.actionType).toBe(PullType.FETCH);
      expect(action.pullData).toMatchObject({
        protocolVersion: 1,
        command: PullType.FETCH,
        capabilities: ['multi_ack', 'thin-pack'],
        wants: [OID1, OID2],
        haves: [OID3],
        done: true,
      });
      expect(action.steps[0].content).toBe(action.pullData);
      expect(action.steps[0].logs[0]).toBe(
        'parsePull - Fetch request (protocol v1): 2 want(s), 1 have(s), 0 want-ref(s), done=true',
      );
    });

    it('parses an empty-but-valid v1 body of only a flush', async () => {
      const action = makeAction();
      const result = await exec(makeReq(FLUSH), action);

      expect(result).toBe(action);
      expect(action.error).toBe(false);
      expect(action.steps[0].stepName).toBe('parsePull');
      expect(action.actionType).toBe(PullType.FETCH);
      expect(action.pullData).toMatchObject({
        protocolVersion: 1,
        command: PullType.FETCH,
        capabilities: [],
        wants: [],
        haves: [],
        done: false,
      });
    });

    it('stores unknown argument lines in options', async () => {
      const action = makeAction();
      await exec(
        makeReq(bodyOf(pkt(`want ${OID1}`), pkt('no-progress'), pkt('done'), FLUSH)),
        action,
      );

      expect(action.error).toBe(false);
      expect(action.pullData).toMatchObject({
        wants: [OID1],
        options: ['no-progress'],
        done: true,
      });
    });

    it('stores the full deepen line and last wins', async () => {
      const action = makeAction();
      await exec(
        makeReq(
          bodyOf(
            pkt(`want ${OID1}`),
            pkt('deepen 1'),
            pkt('deepen-since 1710000000'),
            pkt('deepen-not refs/heads/main'),
            pkt('done'),
            FLUSH,
          ),
        ),
        action,
      );

      expect(action.error).toBe(false);
      expect(action.pullData?.deepen).toBe('deepen-not refs/heads/main');
    });

    it('stores the filter rest as a joined string', async () => {
      const action = makeAction();
      await exec(
        makeReq(bodyOf(pkt(`want ${OID1}`), pkt('filter blob:none'), pkt('done'), FLUSH)),
        action,
      );

      expect(action.error).toBe(false);
      expect(action.pullData?.filter).toBe('blob:none');
    });

    it('collects shallow, want-ref, and ref-prefix into arrays', async () => {
      const action = makeAction();
      await exec(
        makeReq(
          bodyOf(
            pkt(`want ${OID1}`),
            pkt(`shallow ${OID2}`),
            pkt(`shallow ${OID3}`),
            pkt('want-ref refs/heads/main'),
            pkt('want-ref refs/heads/dev'),
            pkt('ref-prefix refs/heads/'),
            pkt('ref-prefix refs/tags/'),
            pkt('done'),
            FLUSH,
          ),
        ),
        action,
      );

      expect(action.error).toBe(false);
      expect(action.pullData).toMatchObject({
        shallow: [OID2, OID3],
        wantRefs: ['refs/heads/main', 'refs/heads/dev'],
        refPrefixes: ['refs/heads/', 'refs/tags/'],
      });
    });
  });

  describe('protocol v2', () => {
    it('detects protocol v2 from a git-protocol header string', async () => {
      const action = makeAction();
      const body = bodyOf(
        pkt('agent=git/2.45.0'),
        pkt('command=fetch'),
        DELIM,
        pkt(`want ${OID1}`),
        FLUSH,
      );

      await exec(makeReq(body, { 'git-protocol': 'version=2' }), action);

      expect(action.error).toBe(false);
      expect(action.actionType).toBe(PullType.FETCH);
      expect(action.pullData).toMatchObject({
        protocolVersion: 2,
        command: PullType.FETCH,
        capabilities: ['agent=git/2.45.0'],
        wants: [OID1],
      });
    });

    it('detects protocol v2 from a git-protocol header array', async () => {
      const action = makeAction();
      const body = bodyOf(
        pkt('agent=git/2.45.0'),
        pkt('command=fetch'),
        DELIM,
        pkt(`want ${OID1}`),
        FLUSH,
      );

      await exec(makeReq(body, { 'git-protocol': ['foo', 'version=2'] }), action);

      expect(action.error).toBe(false);
      expect(action.pullData).toMatchObject({
        protocolVersion: 2,
        command: PullType.FETCH,
        wants: [OID1],
      });
    });

    it('detects protocol v2 from a body starting with command=', async () => {
      const action = makeAction();
      await exec(makeReq(v2FetchBody()), action);

      expect(action.error).toBe(false);
      expect(action.pullData?.protocolVersion).toBe(2);
      expect(action.actionType).toBe(PullType.FETCH);
    });

    it('parses a v2 fetch with capabilities, delim, and arguments', async () => {
      const action = makeAction();
      const result = await exec(makeReq(v2FetchBody()), action);

      expect(result).toBe(action);
      expect(action.error).toBe(false);
      expect(action.steps[0].stepName).toBe('parsePull');
      expect(action.actionType).toBe(PullType.FETCH);
      expect(action.pullData).toMatchObject({
        protocolVersion: 2,
        command: PullType.FETCH,
        capabilities: ['agent=git/2.45.0', 'object-format=sha1'],
        wants: [OID1],
        haves: [OID2],
        done: true,
      });
      expect(action.steps[0].content).toBe(action.pullData);
      expect(action.steps[0].logs[0]).toBe(
        'parsePull - Fetch request (protocol v2): 1 want(s), 1 have(s), 0 want-ref(s), done=true',
      );
    });

    it('parses a v2 ls-refs request and logs prefixes', async () => {
      const action = makeAction();
      const result = await exec(
        makeReq(
          bodyOf(
            pkt('command=ls-refs'),
            DELIM,
            pkt('ref-prefix refs/heads/'),
            pkt('ref-prefix refs/tags/'),
            FLUSH,
          ),
        ),
        action,
      );

      expect(result).toBe(action);
      expect(action.error).toBe(false);
      expect(action.steps[0].stepName).toBe('parsePull');
      expect(action.actionType).toBe(PullType.LS_REFS);
      expect(action.pullData).toMatchObject({
        protocolVersion: 2,
        command: PullType.LS_REFS,
        refPrefixes: ['refs/heads/', 'refs/tags/'],
      });
      expect(action.steps[0].logs[0]).toBe(
        'parsePull - ls-refs request (protocol v2): prefixes=refs/heads/, refs/tags/',
      );
    });

    it('logs <all refs> when ls-refs has no prefixes', async () => {
      const action = makeAction();
      await exec(makeReq(bodyOf(pkt('command=ls-refs'), DELIM, FLUSH)), action);

      expect(action.error).toBe(false);
      expect(action.actionType).toBe(PullType.LS_REFS);
      expect(action.pullData?.refPrefixes).toEqual([]);
      expect(action.steps[0].logs[0]).toContain('<all refs>');
    });

    it('sets an error for an unsupported v2 command', async () => {
      const action = makeAction();
      const result = await exec(makeReq(bodyOf(pkt('command=object-info'), DELIM, FLUSH)), action);

      expect(result).toBe(action);
      expect(action.error).toBe(true);
      expect(action.errorMessage).toContain('Unable to parse pull');
      expect(action.errorMessage).toContain('Unsupported protocol v2 command');
      expect(action.steps).toHaveLength(1);
      expect(action.steps[0].stepName).toBe('parsePull');
    });

    it('sets an error when a v2 request has no command', async () => {
      const action = makeAction();
      await exec(
        makeReq(bodyOf(pkt('agent=git/2.45.0'), FLUSH), { 'git-protocol': 'version=2' }),
        action,
      );

      expect(action.error).toBe(true);
      expect(action.errorMessage).toContain('Unable to parse pull');
      expect(action.errorMessage).toContain('Protocol v2 request did not specify a command');
      expect(action.steps).toHaveLength(1);
    });

    it('ignores packets after a flush', async () => {
      const action = makeAction();
      await exec(
        makeReq(
          bodyOf(pkt('command=fetch'), DELIM, pkt(`want ${OID1}`), FLUSH, pkt(`want ${OID2}`)),
        ),
        action,
      );

      expect(action.error).toBe(false);
      expect(action.pullData?.wants).toEqual([OID1]);
    });

    it('treats argument lines as capabilities when delim is never seen', async () => {
      const action = makeAction();
      await exec(
        makeReq(bodyOf(pkt('command=fetch'), pkt(`want ${OID1}`), pkt(`have ${OID2}`), FLUSH)),
        action,
      );

      expect(action.error).toBe(false);
      expect(action.actionType).toBe(PullType.FETCH);
      expect(action.pullData).toMatchObject({
        protocolVersion: 2,
        command: PullType.FETCH,
        capabilities: [`want ${OID1}`, `have ${OID2}`],
        wants: [],
        haves: [],
      });
    });
  });

  describe('decodeBody and errors', () => {
    it('errors when the request body is missing', async () => {
      const action = makeAction();
      const result = await exec({ headers: {} } as Request, action);

      expect(result).toBe(action);
      expect(action.error).toBe(true);
      expect(action.errorMessage).toContain('Unable to parse pull');
      expect(action.errorMessage).toContain('Request body must be a non-empty Buffer');
      expect(action.steps).toHaveLength(1);
      expect(action.steps[0].stepName).toBe('parsePull');
    });

    it('errors when the request body is not a Buffer', async () => {
      const action = makeAction();
      await exec(makeReq('not a buffer'), action);

      expect(action.error).toBe(true);
      expect(action.errorMessage).toContain('Unable to parse pull');
      expect(action.errorMessage).toContain('Request body must be a non-empty Buffer');
      expect(action.steps).toHaveLength(1);
    });

    it('errors when the request body is an empty Buffer', async () => {
      const action = makeAction();
      await exec(makeReq(Buffer.alloc(0)), action);

      expect(action.error).toBe(true);
      expect(action.errorMessage).toContain('Unable to parse pull');
      expect(action.errorMessage).toContain('Request body must be a non-empty Buffer');
      expect(action.steps).toHaveLength(1);
    });

    it('decompresses a gzip-compressed body', async () => {
      const action = makeAction();
      const compressed = gzipSync(v1FetchBody());
      expect(compressed[0]).toBe(0x1f);
      expect(compressed[1]).toBe(0x8b);

      const result = await exec(makeReq(compressed), action);

      expect(result).toBe(action);
      expect(action.error).toBe(false);
      expect(action.actionType).toBe(PullType.FETCH);
      expect(action.pullData).toMatchObject({
        protocolVersion: 1,
        wants: [OID1, OID2],
        haves: [OID3],
        done: true,
      });
    });

    it('inflates a deflate-encoded body', async () => {
      const action = makeAction();
      const result = await exec(
        makeReq(deflateSync(v1FetchBody()), { 'content-encoding': 'deflate' }),
        action,
      );

      expect(result).toBe(action);
      expect(action.error).toBe(false);
      expect(action.actionType).toBe(PullType.FETCH);
      expect(action.pullData).toMatchObject({
        protocolVersion: 1,
        wants: [OID1, OID2],
        haves: [OID3],
        done: true,
      });
    });

    it('catches an invalid packet and does not throw from exec', async () => {
      const action = makeAction();
      const result = await exec(makeReq(Buffer.from('zzzz', 'utf8')), action);

      expect(result).toBe(action);
      expect(action.error).toBe(true);
      expect(action.errorMessage).toContain('Unable to parse pull');
      expect(action.errorMessage).toContain('Invalid packet line length zzzz');
      expect(action.steps).toHaveLength(1);
      expect(action.steps[0].stepName).toBe('parsePull');
    });

    it('always returns the same action instance', async () => {
      const successAction = makeAction();
      expect(await exec(makeReq(FLUSH), successAction)).toBe(successAction);

      const failureAction = makeAction();
      expect(await exec(makeReq(Buffer.alloc(0)), failureAction)).toBe(failureAction);
    });

    it('sets displayName to parsePull.exec', () => {
      expect(exec.displayName).toBe('parsePull.exec');
    });
  });
});
