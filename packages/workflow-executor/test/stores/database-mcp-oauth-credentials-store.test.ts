/**
 * Spec for the database (Sequelize) MCP OAuth credentials store + its Umzug migration.
 *
 * Behaviour:
 *  - One row per (user_id, mcp_server_id) — UNIQUE (user_id, mcp_server_id); upsert in place.
 *  - Refresh token + client secret are stored as encrypted BLOBs; the store persists opaque bytes
 *    (encryption itself is exercised in credential-encryption.test.ts — the store does not encrypt).
 *  - client_id, client_secret_enc, client_secret_expires_at, scopes are nullable
 *    (null for public / PKCE clients).
 *  - Deleted on disconnect / permanent refresh failure.
 *  - Migration `002_create_mcp_oauth_credentials` is added alongside `001_create_workflow_step_executions`.
 *
 * Store contract:
 *   import DatabaseMcpOAuthCredentialsStore from '../../src/stores/database-mcp-oauth-credentials-store';
 *   const store = new DatabaseMcpOAuthCredentialsStore({ sequelize });
 *   await store.init();                                   // runs the 002 migration (table exists after)
 *   await store.upsert(credential);                       // keyed by (userId, mcpServerId)
 *   const row = await store.get(userId, mcpServerId);     // StoredCredential | null
 *   await store.delete(userId, mcpServerId);
 *   await store.close();
 *
 * Field names are camelCase, mapping to the snake_case columns.
 */
import type { Sequelize as SequelizeType } from 'sequelize';

import { Sequelize } from 'sequelize';

import DatabaseMcpOAuthCredentialsStore from '../../src/stores/database-mcp-oauth-credentials-store';

interface CredentialInput {
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

function makeCredential(overrides: Partial<CredentialInput> = {}): CredentialInput {
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

describe('DatabaseMcpOAuthCredentialsStore (SQLite)', () => {
  let sequelize: SequelizeType;
  let store: DatabaseMcpOAuthCredentialsStore;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    store = new DatabaseMcpOAuthCredentialsStore({ sequelize });
    await store.init();
  });

  afterEach(async () => {
    await store.close();
  });

  describe('get', () => {
    it('returns null for an unknown (userId, mcpServerId)', async () => {
      expect(await store.get(999, 'no-such-server')).toBeNull();
    });

    it('returns the stored credential for a known (userId, mcpServerId)', async () => {
      const credential = makeCredential();

      await store.upsert(credential);
      const row = await store.get(credential.userId, credential.mcpServerId);

      expect(row).toEqual(
        expect.objectContaining({
          userId: 42,
          mcpServerId: 'mcp-server-1',
          clientId: 'client-abc',
          tokenEndpoint: 'https://auth.example.com/token',
          tokenEndpointAuthMethod: 'client_secret_post',
          scopes: 'read write',
        }),
      );
    });

    it('preserves the encrypted blobs byte-for-byte', async () => {
      const refreshTokenEnc = Buffer.from([0x00, 0x01, 0xfe, 0xff, 0x10]);
      const clientSecretEnc = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

      await store.upsert(makeCredential({ refreshTokenEnc, clientSecretEnc }));
      const row = unwrap(await store.get(42, 'mcp-server-1'));

      expect(row.refreshTokenEnc.toString('hex')).toBe(refreshTokenEnc.toString('hex'));
      expect(unwrap(row.clientSecretEnc).toString('hex')).toBe(clientSecretEnc.toString('hex'));
    });
  });

  describe('upsert', () => {
    it('updates the existing row in place for the same (userId, mcpServerId)', async () => {
      await store.upsert(makeCredential({ refreshTokenEnc: Buffer.from('old') }));
      await store.upsert(makeCredential({ refreshTokenEnc: Buffer.from('new') }));

      const row = unwrap(await store.get(42, 'mcp-server-1'));

      expect(row.refreshTokenEnc.toString()).toBe('new');
    });

    it('keeps exactly one row after re-upserting the same key (UNIQUE constraint)', async () => {
      await store.upsert(makeCredential({ refreshTokenEnc: Buffer.from('v1') }));
      await store.upsert(makeCredential({ refreshTokenEnc: Buffer.from('v2') }));

      // Pollution-proof: count only rows for this known key, never the whole table.
      const [rows] = await sequelize.query(
        'SELECT COUNT(*) AS c FROM ai_mcp_oauth_credentials WHERE user_id = 42 AND mcp_server_id = :id',
        { replacements: { id: 'mcp-server-1' } },
      );
      expect(Number((rows[0] as { c: number }).c)).toBe(1);
    });

    it('stores nullable client fields as null for a public / PKCE client', async () => {
      await store.upsert(
        makeCredential({
          clientId: null,
          clientSecretEnc: null,
          clientSecretExpiresAt: null,
          tokenEndpointAuthMethod: 'none',
          scopes: null,
        }),
      );

      const row = await store.get(42, 'mcp-server-1');

      expect(row).toEqual(
        expect.objectContaining({
          clientId: null,
          clientSecretEnc: null,
          clientSecretExpiresAt: null,
          scopes: null,
        }),
      );
    });

    it('persists client_secret_expires_at when provided', async () => {
      const expiresAt = new Date('2030-01-02T03:04:05.000Z');

      await store.upsert(makeCredential({ clientSecretExpiresAt: expiresAt }));
      const row = unwrap(await store.get(42, 'mcp-server-1'));

      expect(new Date(unwrap(row.clientSecretExpiresAt)).toISOString()).toBe(
        expiresAt.toISOString(),
      );
    });
  });

  describe('updateIfPresent', () => {
    it('updates an existing row in place', async () => {
      await store.upsert(makeCredential({ refreshTokenEnc: Buffer.from('old') }));

      await store.updateIfPresent(makeCredential({ refreshTokenEnc: Buffer.from('rotated') }));

      const row = unwrap(await store.get(42, 'mcp-server-1'));
      expect(row.refreshTokenEnc.toString()).toBe('rotated');
    });

    it('does not insert a row when none exists for the key', async () => {
      await store.updateIfPresent(makeCredential());

      expect(await store.get(42, 'mcp-server-1')).toBeNull();
    });
  });

  describe('isolation', () => {
    it('keeps credentials for the same server but different users separate', async () => {
      await store.upsert(makeCredential({ userId: 1, refreshTokenEnc: Buffer.from('user-1') }));
      await store.upsert(makeCredential({ userId: 2, refreshTokenEnc: Buffer.from('user-2') }));

      const rowOne = unwrap(await store.get(1, 'mcp-server-1'));
      const rowTwo = unwrap(await store.get(2, 'mcp-server-1'));

      expect(rowOne.refreshTokenEnc.toString()).toBe('user-1');
      expect(rowTwo.refreshTokenEnc.toString()).toBe('user-2');
    });

    it('keeps credentials for the same user but different servers separate', async () => {
      await store.upsert(
        makeCredential({ mcpServerId: 'server-a', refreshTokenEnc: Buffer.from('a') }),
      );
      await store.upsert(
        makeCredential({ mcpServerId: 'server-b', refreshTokenEnc: Buffer.from('b') }),
      );

      const rowA = unwrap(await store.get(42, 'server-a'));
      const rowB = unwrap(await store.get(42, 'server-b'));

      expect(rowA.refreshTokenEnc.toString()).toBe('a');
      expect(rowB.refreshTokenEnc.toString()).toBe('b');
    });
  });

  describe('delete', () => {
    it('removes the credential for a (userId, mcpServerId)', async () => {
      await store.upsert(makeCredential());

      await store.delete(42, 'mcp-server-1');

      expect(await store.get(42, 'mcp-server-1')).toBeNull();
    });

    it('does not affect other users when deleting one user', async () => {
      await store.upsert(makeCredential({ userId: 1 }));
      await store.upsert(makeCredential({ userId: 2 }));

      await store.delete(1, 'mcp-server-1');

      expect(await store.get(1, 'mcp-server-1')).toBeNull();
      expect(await store.get(2, 'mcp-server-1')).not.toBeNull();
    });

    it('is a no-op (does not throw) when deleting a non-existent credential', async () => {
      await expect(store.delete(999, 'no-such-server')).resolves.toBeUndefined();
    });
  });

  describe('migration / init', () => {
    it('creates the ai_mcp_oauth_credentials table on init', async () => {
      const [rows] = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_mcp_oauth_credentials'",
      );

      expect(rows).toHaveLength(1);
    });

    it('runs init idempotently', async () => {
      await expect(store.init()).resolves.toBeUndefined();
    });

    it('rejects an insert with a null token_endpoint at the DB level', async () => {
      // token_endpoint is NOT NULL: the refresh grant has nowhere to go without it.
      await expect(
        sequelize.query(
          'INSERT INTO ai_mcp_oauth_credentials ' +
            '(user_id, mcp_server_id, refresh_token_enc, created_at, updated_at) ' +
            "VALUES (7, 'mcp-server-1', :blob, :now, :now)",
          { replacements: { blob: Buffer.from('no-endpoint'), now: new Date() } },
        ),
      ).rejects.toThrow();
    });

    it('enforces the UNIQUE (user_id, mcp_server_id) constraint at the DB level', async () => {
      // Direct insert bypassing upsert proves the constraint exists in the schema, not just app logic.
      await store.upsert(makeCredential());

      await expect(
        sequelize.query(
          'INSERT INTO ai_mcp_oauth_credentials ' +
            '(user_id, mcp_server_id, refresh_token_enc, token_endpoint, ' +
            'created_at, updated_at) ' +
            "VALUES (42, 'mcp-server-1', :blob, :tokenEndpoint, :now, :now)",
          {
            replacements: {
              blob: Buffer.from('dup'),
              tokenEndpoint: 'https://auth.example.com/token',
              now: new Date(),
            },
          },
        ),
      ).rejects.toThrow();
    });
  });

  describe('failure handling', () => {
    it('logs and rethrows when the migration fails', async () => {
      const badSequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
      });
      const badStore = new DatabaseMcpOAuthCredentialsStore({ sequelize: badSequelize });

      // Break the query interface so createTable fails mid-migration.
      jest
        .spyOn(badSequelize.getQueryInterface(), 'createTable')
        .mockRejectedValueOnce(new Error('disk full'));

      const logger = jest.fn();
      await expect(badStore.init(logger)).rejects.toThrow('disk full');
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'MCP OAuth credentials migration failed',
        expect.objectContaining({ error: 'disk full' }),
      );

      await badSequelize.close();
    });

    it('close() catches and logs the error instead of throwing', async () => {
      const logger = jest.fn();
      jest.spyOn(sequelize, 'close').mockRejectedValueOnce(new Error('close failed'));

      await expect(store.close(logger)).resolves.toBeUndefined();
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Failed to close database connection',
        expect.objectContaining({ error: 'close failed' }),
      );
    });
  });
});
