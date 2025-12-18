import * as ssh2 from 'ssh2';
import { SSHAgentProxy } from './AgentProxy';

/**
 * Authenticated user information
 */
export interface AuthenticatedUser {
  username: string;
  email?: string;
  gitAccount?: string;
}

/**
 * SSH2 Server Options with proper types
 * Extends the base ssh2 server options with explicit typing
 */
export interface SSH2ServerOptions {
  hostKeys: Buffer[];
  authMethods?: ('publickey' | 'password' | 'keyboard-interactive' | 'none')[];
  keepaliveInterval?: number;
  keepaliveCountMax?: number;
  readyTimeout?: number;
  debug?: (msg: string) => void;
}

/**
 * SSH2 Connection internals (not officially exposed by ssh2)
 * Used to access internal protocol and channel manager
 * CAUTION: These are implementation details and may change in ssh2 updates
 */
export interface SSH2ConnectionInternals {
  _protocol?: {
    openssh_authAgent?: (localChan: number, maxWindow: number, packetSize: number) => void;
    channelSuccess?: (channel: number) => void;
    _handlers?: Record<string, (...args: any[]) => any>;
  };
  _chanMgr?: {
    _channels?: Record<number, any>;
    _count?: number;
  };
  _agent?: {
    _sock?: {
      path?: string;
    };
  };
}

/**
 * Extended SSH connection (server-side) with user context and agent forwarding
 */
export interface ClientWithUser extends ssh2.Connection, SSH2ConnectionInternals {
  authenticatedUser?: AuthenticatedUser;
  clientIp?: string;
  agentForwardingEnabled?: boolean;
  agentChannel?: ssh2.Channel;
  agentProxy?: SSHAgentProxy;
}
