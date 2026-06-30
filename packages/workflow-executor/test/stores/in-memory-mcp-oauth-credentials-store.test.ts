/**
 * Spec for the in-memory MCP OAuth credentials store (dev / --in-memory).
 *
 * Behaviour mirrors the database store's contract, minus persistence:
 *  - One entry per (userId, mcpServerId) — upsert overwrites in place.
 *  - Stores opaque encrypted bytes (no crypto in the store itself).
 *  - get returns null for unknown keys; delete is a no-op for unknown keys.
 *  - State is process-local and lost on restart (same throwaway semantics as InMemoryStore).
 */
import type { McpOAuthCredentialInput } from '../../src/ports/mcp-oauth-credentials-store';

import InMemoryMcpOAuthCredentialsStore from '../../src/stores/in-memory-mcp-oauth-credentials-store';

function makeCredential(overrides: Partial<McpOAuthCredentialInput> = {}): McpOAuthCredentialInput {
  return {
    userId: 42,
    mcpServerId: 'mcp-server-1',
    refreshTokenEnc: Buffer.from('enc-refresh-token'),
    clientId: 'client-abc',
    clientSecretEnc: Buffer.from('enc-client-secret'),
    clientSecretExpiresAt: null,
    tokenEndpoint: 'https://auth.example.com/token',
    tokenEndpointAuthMethod: 'client_secret_post',
    scopes: 'read write',
    ...overrides,
  };
}

// Asserts presence and narrows the type — avoids non-null assertions (`!`), which the codebase avoids.
function unwrap<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('expected a stored credential, got null/undefined');
  }

  return value;
}

describe('InMemoryMcpOAuthCredentialsStore', () => {
  let store: InMemoryMcpOAuthCredentialsStore;

  beforeEach(() => {
    store = new InMemoryMcpOAuthCredentialsStore();
  });

  describe('get', () => {
    it('returns null for an unknown (userId, mcpServerId)', async () => {
      expect(await store.get(999, 'no-such-server')).toBeNull();
    });

    it('returns the stored credential for a known (userId, mcpServerId)', async () => {
      await store.upsert(makeCredential());

      expect(await store.get(42, 'mcp-server-1')).toEqual(
        expect.objectContaining({
          userId: 42,
          mcpServerId: 'mcp-server-1',
          tokenEndpoint: 'https://auth.example.com/token',
        }),
      );
    });

    it('preserves the encrypted blobs byte-for-byte', async () => {
      const refreshTokenEnc = Buffer.from([0x00, 0x01, 0xfe, 0xff]);
      await store.upsert(makeCredential({ refreshTokenEnc }));

      const row = unwrap(await store.get(42, 'mcp-server-1'));

      expect(row.refreshTokenEnc.toString('hex')).toBe(refreshTokenEnc.toString('hex'));
    });
  });

  describe('upsert', () => {
    it('overwrites the existing entry in place for the same key', async () => {
      await store.upsert(makeCredential({ refreshTokenEnc: Buffer.from('old') }));
      await store.upsert(makeCredential({ refreshTokenEnc: Buffer.from('new') }));

      const row = unwrap(await store.get(42, 'mcp-server-1'));

      expect(row.refreshTokenEnc.toString()).toBe('new');
    });

    it('assigns a positive integer id', async () => {
      await store.upsert(makeCredential());

      expect(unwrap(await store.get(42, 'mcp-server-1')).id).toBeGreaterThanOrEqual(1);
    });
  });

  describe('updateIfPresent', () => {
    it('updates an existing row in place', async () => {
      await store.upsert(makeCredential({ refreshTokenEnc: Buffer.from('old') }));

      await store.updateIfPresent(makeCredential({ refreshTokenEnc: Buffer.from('rotated') }));

      expect(unwrap(await store.get(42, 'mcp-server-1')).refreshTokenEnc.toString()).toBe(
        'rotated',
      );
    });

    it('does not insert when the row is absent', async () => {
      await store.updateIfPresent(makeCredential());

      expect(await store.get(42, 'mcp-server-1')).toBeNull();
    });
  });

  describe('isolation', () => {
    it('keeps entries for different users and servers separate', async () => {
      await store.upsert(makeCredential({ userId: 1, refreshTokenEnc: Buffer.from('user-1') }));
      await store.upsert(makeCredential({ userId: 2, refreshTokenEnc: Buffer.from('user-2') }));
      await store.upsert(
        makeCredential({ mcpServerId: 'server-b', refreshTokenEnc: Buffer.from('b') }),
      );

      expect(unwrap(await store.get(1, 'mcp-server-1')).refreshTokenEnc.toString()).toBe('user-1');
      expect(unwrap(await store.get(2, 'mcp-server-1')).refreshTokenEnc.toString()).toBe('user-2');
      expect(unwrap(await store.get(42, 'server-b')).refreshTokenEnc.toString()).toBe('b');
    });
  });

  describe('delete', () => {
    it('removes the credential for a (userId, mcpServerId)', async () => {
      await store.upsert(makeCredential());

      await store.delete(42, 'mcp-server-1');

      expect(await store.get(42, 'mcp-server-1')).toBeNull();
    });

    it('is a no-op (does not throw) for an unknown credential', async () => {
      await expect(store.delete(999, 'no-such-server')).resolves.toBeUndefined();
    });

    it('does not affect other users when deleting one user', async () => {
      await store.upsert(makeCredential({ userId: 1 }));
      await store.upsert(makeCredential({ userId: 2 }));

      await store.delete(1, 'mcp-server-1');

      expect(await store.get(1, 'mcp-server-1')).toBeNull();
      expect(await store.get(2, 'mcp-server-1')).not.toBeNull();
    });
  });

  describe('lifecycle', () => {
    it('init and close are no-ops that resolve', async () => {
      await expect(store.init()).resolves.toBeUndefined();
      await expect(store.close()).resolves.toBeUndefined();
    });
  });
});
