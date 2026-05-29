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

import * as net from 'net';
import * as tls from 'tls';
import * as http from 'http';
import type { Duplex } from 'stream';
import { Agent, AgentConnectOpts } from 'agent-base';
import { URL } from 'url';
// Type declarations live in `src/types/httpntlm.d.ts` — the package ships
// none of its own. We use only the low-level message helpers in `ntlm.js`.
import * as ntlm from 'httpntlm/ntlm';

export type NtlmProxyAgentOptions = {
  proxy: string | URL;
  username: string;
  password: string;
  domain?: string;
  workstation?: string;
};

type ParsedResponse = {
  statusCode: number;
  headers: Record<string, string | string[]>;
};

const CRLFCRLF = Buffer.from('\r\n\r\n');

const parseHeaderBlock = (raw: Buffer): ParsedResponse => {
  const lines = raw.toString('utf8').split('\r\n');
  const m = /^HTTP\/\d\.\d\s+(\d+)/i.exec(lines[0] || '');
  if (!m) throw new Error(`Malformed proxy response status line: ${lines[0]}`);
  const headers: Record<string, string | string[]> = {};
  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i].indexOf(':');
    if (colon === -1) continue;
    const name = lines[i].substring(0, colon).trim().toLowerCase();
    const value = lines[i].substring(colon + 1).trim();
    const existing = headers[name];
    if (existing === undefined) headers[name] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else headers[name] = [existing, value];
  }
  return { statusCode: parseInt(m[1], 10), headers };
};

// Read one full HTTP response (headers + Content-Length body) from a socket
// and push any over-read bytes back onto the socket via `unshift`. This is
// load-bearing for NTLM: between Type1 and Type3 we must consume the 407 body
// so the next read starts cleanly at the second response.
const readProxyResponse = (socket: net.Socket): Promise<ParsedResponse> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let parsed: ParsedResponse | null = null;
    let headerEnd = -1;
    let bodyNeeded = 0;

    const cleanup = () => {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('end', onEnd);
    };

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      const all = Buffer.concat(chunks);

      if (!parsed) {
        const sep = all.indexOf(CRLFCRLF);
        if (sep === -1) return;
        try {
          parsed = parseHeaderBlock(all.subarray(0, sep));
        } catch (err) {
          cleanup();
          return reject(err);
        }
        headerEnd = sep + CRLFCRLF.length;
        const cl = parsed.headers['content-length'];
        const clNum = typeof cl === 'string' ? parseInt(cl, 10) : NaN;
        bodyNeeded = Number.isFinite(clNum) ? clNum : 0;
      }

      const total = headerEnd + bodyNeeded;
      if (all.length >= total) {
        const overshoot = all.subarray(total);
        if (overshoot.length > 0) socket.unshift(overshoot);
        cleanup();
        resolve(parsed);
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error('Upstream proxy closed connection before sending complete response'));
    };

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('end', onEnd);
  });
};

const pickNtlmChallenge = (header: string | string[] | undefined): string | undefined => {
  if (!header) return undefined;
  const values = Array.isArray(header) ? header : [header];
  return values.find((v) => /^NTLM\s+\S/i.test(v));
};

/**
 * HTTP(S) proxy agent that authenticates against the upstream proxy using NTLM
 * (Type1 / Type2 / Type3) before tunneling each request. Each new socket runs
 * its own handshake — NTLM auth is bound to the TCP connection.
 */
export class NtlmProxyAgent extends Agent {
  readonly proxy: URL;
  private readonly username: string;
  private readonly password: string;
  private readonly domain: string;
  private readonly workstation: string;

  constructor(opts: NtlmProxyAgentOptions) {
    super();
    this.proxy = typeof opts.proxy === 'string' ? new URL(opts.proxy) : opts.proxy;
    if (this.proxy.protocol !== 'http:' && this.proxy.protocol !== 'https:') {
      throw new Error(
        `Unsupported upstream proxy URL scheme "${this.proxy.protocol.replace(/:$/, '')}": only http and https are supported`,
      );
    }
    this.username = opts.username;
    this.password = opts.password;
    this.domain = opts.domain ?? '';
    this.workstation = opts.workstation ?? '';
  }

  async connect(_req: http.ClientRequest, opts: AgentConnectOpts): Promise<Duplex> {
    if (!opts.host || !opts.port) {
      throw new TypeError('NtlmProxyAgent: missing host/port on request');
    }

    const proxyHost = (this.proxy.hostname || this.proxy.host).replace(/^\[|\]$/g, '');
    const proxyPort = this.proxy.port
      ? parseInt(this.proxy.port, 10)
      : this.proxy.protocol === 'https:'
        ? 443
        : 80;

    const socket = await this.openProxySocket(proxyHost, proxyPort);

    try {
      const targetHost = net.isIPv6(opts.host) ? `[${opts.host}]` : opts.host;
      const connectLine = `CONNECT ${targetHost}:${opts.port} HTTP/1.1`;

      // Round 1: CONNECT carrying Type1.
      const type1 = ntlm.createType1Message({
        workstation: this.workstation,
        domain: this.domain,
      });
      socket.write(
        `${connectLine}\r\n` +
          `Host: ${targetHost}:${opts.port}\r\n` +
          `Proxy-Authorization: ${type1}\r\n` +
          `Proxy-Connection: Keep-Alive\r\n` +
          `Connection: Keep-Alive\r\n` +
          `\r\n`,
      );

      const round1 = await readProxyResponse(socket);
      if (round1.statusCode !== 407) {
        throw new Error(
          `Expected 407 in NTLM round 1, got ${round1.statusCode} from upstream proxy`,
        );
      }
      const challenge = pickNtlmChallenge(round1.headers['proxy-authenticate']);
      if (!challenge) {
        throw new Error(
          'Upstream proxy returned 407 but did not include an NTLM challenge in Proxy-Authenticate',
        );
      }

      // Round 2: CONNECT carrying Type3 on the same socket.
      const type2 = ntlm.parseType2Message(challenge);
      const type3 = ntlm.createType3Message(type2, {
        username: this.username,
        password: this.password,
        workstation: this.workstation,
        domain: this.domain,
      });
      socket.write(
        `${connectLine}\r\n` +
          `Host: ${targetHost}:${opts.port}\r\n` +
          `Proxy-Authorization: ${type3}\r\n` +
          `Proxy-Connection: Keep-Alive\r\n` +
          `Connection: Keep-Alive\r\n` +
          `\r\n`,
      );

      const round2 = await readProxyResponse(socket);
      if (round2.statusCode !== 200) {
        throw new Error(
          `NTLM authentication to upstream proxy failed: status ${round2.statusCode}`,
        );
      }

      if (opts.secureEndpoint) {
        return tls.connect({
          ...opts,
          socket,
          servername: opts.servername ?? (net.isIP(opts.host) ? undefined : opts.host),
        });
      }
      return socket;
    } catch (err) {
      socket.destroy();
      throw err;
    }
  }

  private openProxySocket(host: string, port: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket: net.Socket =
        this.proxy.protocol === 'https:'
          ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host })
          : net.connect({ host, port });
      const readyEvent = this.proxy.protocol === 'https:' ? 'secureConnect' : 'connect';
      const onReady = () => {
        socket.removeListener('error', onError);
        resolve(socket);
      };
      const onError = (err: Error) => {
        socket.removeListener(readyEvent, onReady);
        reject(err);
      };
      socket.once(readyEvent, onReady);
      socket.once('error', onError);
    });
  }
}
