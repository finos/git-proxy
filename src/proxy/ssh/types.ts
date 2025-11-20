import * as ssh2 from 'ssh2';

/**
 * Authenticated user information
 */
export interface AuthenticatedUser {
  username: string;
  email?: string;
  gitAccount?: string;
}

/**
 * Extended SSH connection (server-side) with user context and agent forwarding
 */
export interface ClientWithUser extends ssh2.Connection {
  authenticatedUser?: AuthenticatedUser;
  clientIp?: string;
  agentForwardingEnabled?: boolean;
  agentChannel?: ssh2.Channel;
  agentProxy?: any;
}
