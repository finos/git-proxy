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

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProtocol,
  getChannelManager,
  findAvailableChannelId,
  getChannelModule,
  getSessionOutgoingChannelId,
  getInstalledSsh2Version,
} from '../../src/proxy/ssh/sshInternals';

describe('sshInternals', () => {
  describe('getProtocol', () => {
    it('should return protocol when all internals are present', () => {
      const mockClient = {
        _protocol: {
          openssh_authAgent: () => {},
          channelSuccess: () => {},
          _handlers: {},
        },
      };

      const proto = getProtocol(mockClient as any);
      expect(proto).toBe(mockClient._protocol);
    });

    it('should throw when _protocol is missing', () => {
      expect(() => getProtocol({} as any)).toThrow('client._protocol is missing');
    });

    it('should throw when openssh_authAgent is missing', () => {
      const mockClient = {
        _protocol: {
          channelSuccess: () => {},
          _handlers: {},
        },
      };

      expect(() => getProtocol(mockClient as any)).toThrow(
        'openssh_authAgent is missing or not a function',
      );
    });

    it('should throw when channelSuccess is missing', () => {
      const mockClient = {
        _protocol: {
          openssh_authAgent: () => {},
          _handlers: {},
        },
      };

      expect(() => getProtocol(mockClient as any)).toThrow(
        'channelSuccess is missing or not a function',
      );
    });

    it('should throw when _handlers is missing', () => {
      const mockClient = {
        _protocol: {
          openssh_authAgent: () => {},
          channelSuccess: () => {},
        },
      };

      expect(() => getProtocol(mockClient as any)).toThrow('_handlers is missing or not an object');
    });

    it('should include ssh2 version in error messages', () => {
      try {
        getProtocol({} as any);
      } catch (e) {
        expect((e as Error).message).toContain('installed ssh2 version');
        expect((e as Error).message).toContain('verified working on');
      }
    });
  });

  describe('getChannelManager', () => {
    it('should return channel manager when internals are present', () => {
      const mockClient = {
        _chanMgr: {
          _channels: {},
          _count: 0,
        },
      };

      const chanMgr = getChannelManager(mockClient as any);
      expect(chanMgr).toBe(mockClient._chanMgr);
    });

    it('should throw when _chanMgr is missing', () => {
      expect(() => getChannelManager({} as any)).toThrow('client._chanMgr is missing');
    });

    it('should throw when _channels is missing', () => {
      const mockClient = { _chanMgr: { _count: 0 } };
      expect(() => getChannelManager(mockClient as any)).toThrow(
        '_chanMgr._channels is missing or not an object',
      );
    });

    it('should throw when _count is missing', () => {
      const mockClient = { _chanMgr: { _channels: {} } };
      expect(() => getChannelManager(mockClient as any)).toThrow(
        '_chanMgr._count is missing or not a number',
      );
    });
  });

  describe('findAvailableChannelId', () => {
    it('should return startId when no channels are in use', () => {
      const chanMgr = { _channels: {}, _count: 0 };
      expect(findAvailableChannelId(chanMgr, 1)).toBe(1);
    });

    it('should skip occupied channel IDs', () => {
      const chanMgr = {
        _channels: { 1: 'occupied', 2: 'occupied', 3: 'occupied' } as any,
        _count: 3,
      };
      expect(findAvailableChannelId(chanMgr, 1)).toBe(4);
    });

    it('should return custom startId when specified', () => {
      const chanMgr = { _channels: {}, _count: 0 };
      expect(findAvailableChannelId(chanMgr, 5)).toBe(5);
    });

    it('should find gaps in channel IDs', () => {
      const chanMgr = {
        _channels: { 1: 'a', 3: 'b' } as any,
        _count: 2,
      };
      expect(findAvailableChannelId(chanMgr, 1)).toBe(2);
    });
  });

  describe('getChannelModule', () => {
    it('should return a valid channel module', () => {
      const mod = getChannelModule();
      expect(typeof mod.Channel).toBe('function');
      expect(typeof mod.MAX_WINDOW).toBe('number');
      expect(typeof mod.PACKET_SIZE).toBe('number');
    });

    it('should return cached module on subsequent calls', () => {
      const first = getChannelModule();
      const second = getChannelModule();
      expect(first).toBe(second);
    });
  });

  describe('getSessionOutgoingChannelId', () => {
    it('should return channel id when _chanInfo is present', () => {
      const session = { _chanInfo: { outgoing: { id: 42 } } };
      expect(getSessionOutgoingChannelId(session)).toBe(42);
    });

    it('should return undefined when _chanInfo is missing', () => {
      expect(getSessionOutgoingChannelId({})).toBeUndefined();
    });

    it('should return undefined when outgoing is missing', () => {
      const session = { _chanInfo: {} };
      expect(getSessionOutgoingChannelId(session)).toBeUndefined();
    });

    it('should return undefined when id is not a number', () => {
      const session = { _chanInfo: { outgoing: { id: 'not-a-number' } } };
      expect(getSessionOutgoingChannelId(session)).toBeUndefined();
    });

    it('should return undefined for null session', () => {
      expect(getSessionOutgoingChannelId(null)).toBeUndefined();
    });
  });

  describe('getInstalledSsh2Version', () => {
    it('should return a version string', () => {
      const version = getInstalledSsh2Version();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });
  });
});
