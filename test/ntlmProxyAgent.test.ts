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

import { describe, it, expect, afterEach } from 'vitest';
import * as net from 'net';
import * as http from 'http';
import { NtlmProxyAgent } from '../src/proxy/upstream/ntlm-proxy-agent';

type MockProxy = {
  port: number;
  server: net.Server;
  events: Array<{ socketId: number; phase: 'round1' | 'round2'; headers: string }>;
  socketCount: number;
};

// Minimal hand-built NTLM Type2 message — enough for decodeType2Message to
// extract a challenge and for our agent to feed createType3Message.
const buildType2Header = (): string => {
  const buf = Buffer.alloc(48);
  buf.write('NTLMSSP\0', 0, 8, 'ascii');
  buf.writeUInt32LE(2, 8); // message type = 2
  buf.writeUInt16LE(0, 12); // target name len
  buf.writeUInt16LE(0, 14); // target name maxlen
  buf.writeUInt32LE(0, 16); // target name offset
  buf.writeUInt32LE(0x00000201, 20); // flags: NEGOTIATE_OEM | NEGOTIATE_NTLM_KEY
  Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).copy(buf, 24); // 8-byte challenge
  return `NTLM ${buf.toString('base64')}`;
};

const readHeaders = (socket: net.Socket): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      const all = Buffer.concat(chunks);
      const sep = all.indexOf('\r\n\r\n');
      if (sep !== -1) {
        socket.removeListener('data', onData);
        socket.removeListener('error', onError);
        // CONNECT requests have no body — anything past CRLFCRLF would be
        // pipelined data, which our agent doesn't do. Discard the rest.
        resolve(all.subarray(0, sep).toString('utf8'));
      }
    };
    const onError = (err: Error) => {
      socket.removeListener('data', onData);
      reject(err);
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
};

type ProxyOptions = {
  failRound1Status?: number; // e.g. 502 to bypass NTLM
  omitNtlmChallenge?: boolean; // 407 with Basic challenge instead of NTLM
  failRound2?: boolean; // round 2 returns 407 (auth rejected)
  injectBodyOnRound1?: string; // include a body that the agent must consume
};

const startMockProxy = (opts: ProxyOptions = {}): Promise<MockProxy> => {
  return new Promise((resolve) => {
    const events: MockProxy['events'] = [];
    let socketCount = 0;

    const server = net.createServer(async (socket) => {
      socketCount += 1;
      const socketId = socketCount;
      try {
        // Round 1
        const h1 = await readHeaders(socket);
        events.push({ socketId, phase: 'round1', headers: h1 });

        if (opts.failRound1Status) {
          socket.write(
            `HTTP/1.1 ${opts.failRound1Status} Bad Gateway\r\nContent-Length: 0\r\n\r\n`,
          );
          return;
        }

        const round1Challenge = opts.omitNtlmChallenge ? 'Basic realm="proxy"' : buildType2Header();
        const body = opts.injectBodyOnRound1 ?? '';
        socket.write(
          `HTTP/1.1 407 Proxy Authentication Required\r\n` +
            `Proxy-Authenticate: ${round1Challenge}\r\n` +
            `Content-Length: ${Buffer.byteLength(body)}\r\n` +
            `\r\n` +
            body,
        );

        if (opts.omitNtlmChallenge) return; // agent will reject — no round 2

        // Round 2
        const h2 = await readHeaders(socket);
        events.push({ socketId, phase: 'round2', headers: h2 });

        if (opts.failRound2) {
          socket.write(
            `HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: NTLM\r\nContent-Length: 0\r\n\r\n`,
          );
          return;
        }
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      } catch {
        // ignore — test will assert on what it observed
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        server,
        events,
        get socketCount() {
          return socketCount;
        },
      });
    });
  });
};

const fakeReq = {} as http.ClientRequest;

describe('NtlmProxyAgent', () => {
  let teardown: Array<() => void> = [];

  afterEach(() => {
    teardown.forEach((fn) => fn());
    teardown = [];
  });

  it('completes Type1 → Type3 handshake on a single TCP socket', async () => {
    const proxy = await startMockProxy();
    teardown.push(() => proxy.server.close());

    const agent = new NtlmProxyAgent({
      proxy: `http://127.0.0.1:${proxy.port}`,
      username: 'alice',
      password: 's3cret',
      domain: 'CORP',
      workstation: 'LAPTOP-42',
    });

    const sock = await agent.connect(fakeReq, {
      host: 'example.com',
      port: 443,
      secureEndpoint: false,
    } as any);
    teardown.push(() => (sock as net.Socket).destroy());

    // Both rounds happened on the SAME socket (socket-bound NTLM).
    expect(proxy.socketCount).toBe(1);
    expect(proxy.events).toHaveLength(2);
    expect(proxy.events[0].socketId).toBe(proxy.events[1].socketId);

    const round1 = proxy.events[0].headers;
    expect(round1).toMatch(/^CONNECT example\.com:443 HTTP\/1\.1/m);

    const type1Match = /Proxy-Authorization: NTLM (\S+)/.exec(round1);
    expect(type1Match).not.toBeNull();
    const type1 = Buffer.from(type1Match![1], 'base64');
    expect(type1.subarray(0, 8).toString('ascii')).toBe('NTLMSSP\0');
    expect(type1.readUInt32LE(8)).toBe(1); // message type 1

    const round2 = proxy.events[1].headers;
    const type3Match = /Proxy-Authorization: NTLM (\S+)/.exec(round2);
    expect(type3Match).not.toBeNull();
    const type3 = Buffer.from(type3Match![1], 'base64');
    expect(type3.subarray(0, 8).toString('ascii')).toBe('NTLMSSP\0');
    expect(type3.readUInt32LE(8)).toBe(3); // message type 3
  });

  it('consumes the round-1 response body before sending Type3', async () => {
    // If the agent doesn't consume the 407 body, the leftover bytes will be
    // prepended to the next read and corrupt the round-2 response parse.
    const proxy = await startMockProxy({
      injectBodyOnRound1: '<html>nope</html>',
    });
    teardown.push(() => proxy.server.close());

    const agent = new NtlmProxyAgent({
      proxy: `http://127.0.0.1:${proxy.port}`,
      username: 'alice',
      password: 's3cret',
    });

    const sock = await agent.connect(fakeReq, {
      host: 'example.com',
      port: 80,
      secureEndpoint: false,
    } as any);
    teardown.push(() => (sock as net.Socket).destroy());

    expect(proxy.events).toHaveLength(2);
    // The round-2 CONNECT must start cleanly; if the body wasn't consumed,
    // the proxy's parse would have failed and we'd never have reached this.
    expect(proxy.events[1].headers).toMatch(/^CONNECT example\.com:80/m);
  });

  it('rejects when proxy does not return 407 to round 1', async () => {
    const proxy = await startMockProxy({ failRound1Status: 502 });
    teardown.push(() => proxy.server.close());

    const agent = new NtlmProxyAgent({
      proxy: `http://127.0.0.1:${proxy.port}`,
      username: 'alice',
      password: 's3cret',
    });

    await expect(
      agent.connect(fakeReq, { host: 'example.com', port: 80, secureEndpoint: false } as any),
    ).rejects.toThrow(/Expected 407.*got 502/);
  });

  it('rejects when 407 lacks NTLM challenge', async () => {
    const proxy = await startMockProxy({ omitNtlmChallenge: true });
    teardown.push(() => proxy.server.close());

    const agent = new NtlmProxyAgent({
      proxy: `http://127.0.0.1:${proxy.port}`,
      username: 'alice',
      password: 's3cret',
    });

    await expect(
      agent.connect(fakeReq, { host: 'example.com', port: 80, secureEndpoint: false } as any),
    ).rejects.toThrow(/did not include an NTLM challenge/);
  });

  it('rejects when round 2 returns 407 (credentials rejected)', async () => {
    const proxy = await startMockProxy({ failRound2: true });
    teardown.push(() => proxy.server.close());

    const agent = new NtlmProxyAgent({
      proxy: `http://127.0.0.1:${proxy.port}`,
      username: 'alice',
      password: 'wrong',
    });

    await expect(
      agent.connect(fakeReq, { host: 'example.com', port: 80, secureEndpoint: false } as any),
    ).rejects.toThrow(/NTLM authentication.*failed.*407/);
  });

  it('throws on unsupported proxy URL scheme', () => {
    expect(
      () =>
        new NtlmProxyAgent({
          proxy: 'socks5://proxy.example.com:1080',
          username: 'alice',
          password: 's3cret',
        }),
    ).toThrow(/Unsupported.*scheme.*socks5/i);
  });
});
