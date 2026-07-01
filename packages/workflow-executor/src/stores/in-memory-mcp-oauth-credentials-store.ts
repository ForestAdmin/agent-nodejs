import type {
  McpOAuthCredentialInput,
  McpOAuthCredentialsStore,
  StoredMcpOAuthCredential,
} from '../ports/mcp-oauth-credentials-store';

// In-memory MCP OAuth credentials store for --in-memory / dev. Same throwaway semantics as
// InMemoryStore (the run store): state is lost on restart. It holds the already-encrypted Buffers
// produced by buildMcpOAuthCredentialInput — there is no crypto here, just a Map keyed by
// (userId, mcpServerId), mirroring the DB store's one-row-per-key contract.
export default class InMemoryMcpOAuthCredentialsStore implements McpOAuthCredentialsStore {
  private readonly data = new Map<string, StoredMcpOAuthCredential>();
  private nextId = 1;

  async init(): Promise<void> {
    // No-op: nothing to migrate for an in-memory store.
  }

  async close(): Promise<void> {
    // No-op: nothing to close.
  }

  async get(userId: number, mcpServerId: string): Promise<StoredMcpOAuthCredential | null> {
    return this.data.get(InMemoryMcpOAuthCredentialsStore.key(userId, mcpServerId)) ?? null;
  }

  async upsert(credential: McpOAuthCredentialInput): Promise<void> {
    // Overwrite in place — one row per (userId, mcpServerId). A fresh id each time mirrors the DB
    // store's delete-then-insert; nothing relies on id stability.
    const key = InMemoryMcpOAuthCredentialsStore.key(credential.userId, credential.mcpServerId);
    this.data.set(key, { ...credential, id: this.nextId });
    this.nextId += 1;
  }

  async delete(userId: number, mcpServerId: string): Promise<void> {
    this.data.delete(InMemoryMcpOAuthCredentialsStore.key(userId, mcpServerId));
  }

  private static key(userId: number, mcpServerId: string): string {
    return `${userId}:${mcpServerId}`;
  }
}
