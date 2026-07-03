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

/**
 * Thin abstraction over ssh2 internal APIs.
 *
 * ssh2 does not expose a public server-side API for opening an
 * `auth-agent@openssh.com` channel back to the connected client. To implement
 * SSH agent forwarding from the server side we reach into underscore-prefixed
 * internals (`_protocol`, `_chanMgr`, `_handlers`) and into the internal module
 * `ssh2/lib/Channel`. Those symbols have NO semver stability guarantee.
 *
 * This module is the ONLY place allowed to access those internals. Every access
 * is guarded and throws a descriptive, version-aware error when the shape of
 * the internals changes. If ssh2 is upgraded and something breaks, the error
 * will tell you which symbol disappeared and on which installed version.
 *
 * Verified working against ssh2 1.17.x. The package.json pin is `~1.17.0`
 * (patch-only) to force a manual review on minor/major bumps.
 */

import * as ssh2 from 'ssh2';

const ssh2Version: string = (() => {
  try {
    return require('ssh2/package.json').version;
  } catch {
    return 'unknown';
  }
})();

const VERIFIED_RANGE = '1.17.x';

function fail(detail: string): never {
  throw new Error(
    `ssh2 internal API changed: ${detail} ` +
      `(installed ssh2 version: ${ssh2Version}, verified working on ${VERIFIED_RANGE}). ` +
      `If you upgraded ssh2, review src/proxy/ssh/sshInternals.ts and pin to a known-working version.`,
  );
}

export interface Ssh2Protocol {
  openssh_authAgent(localChan: number, maxWindow: number, packetSize: number): void;
  channelSuccess(channelId: number): void;
  _handlers: Record<string, (...args: unknown[]) => unknown>;
}

export interface Ssh2ChannelManager {
  _channels: Record<number, unknown>;
  _count: number;
}

export interface ChannelConstructor {
  new (client: unknown, info: unknown, opts: { server: boolean }): unknown;
}

export interface ChannelModule {
  Channel: ChannelConstructor;
  MAX_WINDOW: number;
  PACKET_SIZE: number;
}

/**
 * Retrieve the internal `_protocol` object of an ssh2 Connection.
 * Throws a descriptive error if the internal shape is not as expected.
 */
export function getProtocol(client: ssh2.Connection): Ssh2Protocol {
  const proto = (client as unknown as { _protocol?: unknown })._protocol as
    | Partial<Ssh2Protocol>
    | undefined;
  if (!proto) fail('client._protocol is missing');
  if (typeof proto.openssh_authAgent !== 'function') {
    fail('client._protocol.openssh_authAgent is missing or not a function');
  }
  if (typeof proto.channelSuccess !== 'function') {
    fail('client._protocol.channelSuccess is missing or not a function');
  }
  if (!proto._handlers || typeof proto._handlers !== 'object') {
    fail('client._protocol._handlers is missing or not an object');
  }
  return proto as Ssh2Protocol;
}

/**
 * Retrieve the internal `_chanMgr` object of an ssh2 Connection.
 */
export function getChannelManager(client: ssh2.Connection): Ssh2ChannelManager {
  const chanMgr = (client as unknown as { _chanMgr?: unknown })._chanMgr as
    | Partial<Ssh2ChannelManager>
    | undefined;
  if (!chanMgr) fail('client._chanMgr is missing');
  if (!chanMgr._channels || typeof chanMgr._channels !== 'object') {
    fail('client._chanMgr._channels is missing or not an object');
  }
  if (typeof chanMgr._count !== 'number') {
    fail('client._chanMgr._count is missing or not a number');
  }
  return chanMgr as Ssh2ChannelManager;
}

/**
 * Find the first channel ID not currently in use by the given channel manager.
 * Starts scanning at `startId` (default 1; 0 is typically the main session).
 */
export function findAvailableChannelId(chanMgr: Ssh2ChannelManager, startId = 1): number {
  let id = startId;
  while (chanMgr._channels[id] !== undefined) id++;
  return id;
}

let cachedChannelModule: ChannelModule | null = null;

/**
 * Load the internal `ssh2/lib/Channel` module and validate its exports.
 * The result is cached for subsequent calls.
 */
export function getChannelModule(): ChannelModule {
  if (cachedChannelModule) return cachedChannelModule;

  let mod: Partial<ChannelModule>;
  try {
    mod = require('ssh2/lib/Channel');
  } catch (err) {
    fail(`cannot require('ssh2/lib/Channel'): ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof mod.Channel !== 'function') fail('ssh2/lib/Channel does not export Channel');
  if (typeof mod.MAX_WINDOW !== 'number') fail('ssh2/lib/Channel does not export MAX_WINDOW');
  if (typeof mod.PACKET_SIZE !== 'number') fail('ssh2/lib/Channel does not export PACKET_SIZE');

  cachedChannelModule = mod as ChannelModule;
  return cachedChannelModule;
}

/**
 * Extract the outgoing channel id from an ssh2 server session via its internal
 * `_chanInfo` property. Returns undefined if the info is not available yet.
 * Used to send a manual CHANNEL_SUCCESS when the client sets wantReply=false.
 */
export function getSessionOutgoingChannelId(session: unknown): number | undefined {
  const info = (session as { _chanInfo?: { outgoing?: { id?: unknown } } } | undefined)?._chanInfo;
  const id = info?.outgoing?.id;
  return typeof id === 'number' ? id : undefined;
}

/**
 * For tests: exposes the installed version string.
 */
export function getInstalledSsh2Version(): string {
  return ssh2Version;
}
