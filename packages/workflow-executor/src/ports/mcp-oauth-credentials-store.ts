import type { Logger } from './logger-port';

export interface McpOAuthCredentialInput {
  userId: number;
  mcpServerId: string;
  refreshTokenEnc: Buffer;
  clientId?: string | null;
  clientSecretEnc?: Buffer | null;
  clientSecretExpiresAt?: Date | null;
  tokenEndpoint: string;
  tokenEndpointAuthMethod?: string | null;
  scopes?: string | null;
}

export interface StoredMcpOAuthCredential extends McpOAuthCredentialInput {
  id: number;
}

// Persists OAuth MCP credentials, one row per (userId, mcpServerId). Backed by a Sequelize store
// (real executors) or an in-memory one (--in-memory / dev). Holds opaque encrypted bytes —
// encryption happens upstream in buildMcpOAuthCredentialInput — so implementations do no crypto.
export interface McpOAuthCredentialsStore {
  init(logger?: Logger): Promise<void>;
  close(logger?: Logger): Promise<void>;
  get(userId: number, mcpServerId: string): Promise<StoredMcpOAuthCredential | null>;
  upsert(credential: McpOAuthCredentialInput): Promise<void>;
  delete(userId: number, mcpServerId: string): Promise<void>;
}
