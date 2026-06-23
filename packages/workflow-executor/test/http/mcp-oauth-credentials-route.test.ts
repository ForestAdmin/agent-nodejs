/**
 * Spec for the OAuth credential deposit endpoint.
 *
 * Behaviour:
 *  - POST /mcp-oauth-credentials and DELETE deposit/disconnect, on the SAME HTTP server as /trigger.
 *  - Authenticated by the existing koaJwt middleware (forest_session_token, FOREST_AUTH_SECRET).
 *  - user_id is taken from the validated token, NEVER from the request body.
 *  - The executor encrypts the refresh token (+ client secret) and upserts one row per (user, server).
 *  - When FOREST_EXECUTOR_ENCRYPTION_KEY is unset, encryption fails closed and the endpoint returns
 *    a distinct, typed `executor_encryption_key_missing` (HTTP 503) — never a generic failure.
 *  - Dormant for now: nothing reads the table at runtime yet; only this deposit path writes it.
 *
 * Endpoint contract:
 *  - ExecutorHttpServer options gain: `mcpOAuthCredentialsStore` (upsert/get/delete) and
 *    `credentialEncryption` (encrypt/decrypt). Both injected like `runner` / `workflowPort`.
 *  - POST body (camelCase JSON): { mcpServerId, refreshToken, clientId?, clientSecret?,
 *    clientSecretExpiresAt?, tokenEndpoint?, tokenEndpointAuthMethod?, scopes? }.
 *  - DELETE path: /mcp-oauth-credentials/:mcpServerId.
 *  - Typed key-missing response: HTTP 503 with body { code: 'executor_encryption_key_missing' }.
 */
import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';

import { ExecutorEncryptionKeyMissingError } from '../../src/errors';
import ExecutorHttpServer from '../../src/http/executor-http-server';

const AUTH_SECRET = 'test-auth-secret';

function signToken(payload: object, secret = AUTH_SECRET, options?: jsonwebtoken.SignOptions) {
  return jsonwebtoken.sign(payload, secret, { expiresIn: '1h', ...options });
}

function createMockRunner() {
  return {
    state: 'running',
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    triggerPoll: jest.fn().mockResolvedValue(undefined),
    getRunStepExecutions: jest.fn().mockResolvedValue([]),
  };
}

function createMockWorkflowPort() {
  return {
    getAvailableRuns: jest.fn().mockResolvedValue({ pending: [], malformed: [] }),
    getAvailableRun: jest.fn(),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest.fn(),
    getMcpServerConfigs: jest.fn().mockResolvedValue({}),
    hasRunAccess: jest.fn().mockResolvedValue(true),
  };
}

function createMockStore() {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockEncryption() {
  return {
    // Deterministic stub: the route under test only needs an opaque blob + version back.
    encrypt: jest.fn((plaintext: string) => ({
      ciphertext: Buffer.from(`enc(${plaintext})`),
      encKeyVersion: 1,
    })),
    decrypt: jest.fn(),
  };
}

function createServer(overrides: Record<string, unknown> = {}) {
  return new ExecutorHttpServer({
    port: 0,
    runner: createMockRunner(),
    authSecret: AUTH_SECRET,
    workflowPort: createMockWorkflowPort(),
    mcpOAuthCredentialsStore: createMockStore(),
    credentialEncryption: createMockEncryption(),
    ...overrides,
  } as never);
}

const validBody = {
  mcpServerId: 'mcp-server-1',
  refreshToken: 'refresh-token-xyz',
  clientId: 'client-abc',
  clientSecret: 'client-secret-123',
  tokenEndpoint: 'https://auth.example.com/token',
  tokenEndpointAuthMethod: 'client_secret_post',
  scopes: 'read write',
};

describe('POST /mcp-oauth-credentials', () => {
  describe('authentication', () => {
    it('returns 401 when no token is provided', async () => {
      const server = createServer();

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .send(validBody);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when the token is signed with the wrong secret', async () => {
      const server = createServer();
      const token = signToken({ id: 1 }, 'wrong-secret');

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(response.status).toBe(401);
    });

    it('does not write to the store when unauthenticated', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });

      await request(server.callback).post('/mcp-oauth-credentials').send(validBody);

      expect(store.upsert).not.toHaveBeenCalled();
    });
  });

  describe('user identity from token', () => {
    it('upserts using the user id from the token', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 7 });

      await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(store.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, mcpServerId: 'mcp-server-1' }),
      );
    });

    it('rejects a body that tries to supply a user id (the token is the only source)', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 7 });

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBody, userId: 999, user_id: 999 });

      expect(response.status).toBe(400);
      expect(store.upsert).not.toHaveBeenCalled();
    });

    it('returns 401 when the token carries no numeric id (rejected by the claims middleware)', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ email: 'no-id@example.com' });

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(response.status).toBe(401);
      expect(store.upsert).not.toHaveBeenCalled();
    });
  });

  describe('encryption before persistence', () => {
    it('encrypts the refresh token and stores only the ciphertext (never plaintext)', async () => {
      const store = createMockStore();
      const encryption = createMockEncryption();
      const server = createServer({
        mcpOAuthCredentialsStore: store,
        credentialEncryption: encryption,
      });
      const token = signToken({ id: 1 });

      await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(encryption.encrypt).toHaveBeenCalledWith('refresh-token-xyz');
      const persisted = store.upsert.mock.calls[0][0];
      expect(Buffer.isBuffer(persisted.refreshTokenEnc)).toBe(true);
      expect(persisted.refreshTokenEnc.toString()).toBe('enc(refresh-token-xyz)');
      expect(persisted.encKeyVersion).toBe(1);
      // The plaintext must not have been handed to the store under any field.
      expect(JSON.stringify(persisted)).not.toContain('refresh-token-xyz');
    });

    it('encrypts the client secret when one is provided', async () => {
      const store = createMockStore();
      const encryption = createMockEncryption();
      const server = createServer({
        mcpOAuthCredentialsStore: store,
        credentialEncryption: encryption,
      });
      const token = signToken({ id: 1 });

      await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(encryption.encrypt).toHaveBeenCalledWith('client-secret-123');
      expect(store.upsert.mock.calls[0][0].clientSecretEnc.toString()).toBe(
        'enc(client-secret-123)',
      );
    });

    it('stores a null client secret for a public / PKCE client (no clientSecret in body)', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 1 });
      const { clientSecret, ...publicBody } = validBody;

      await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...publicBody, tokenEndpointAuthMethod: 'none' });

      expect(store.upsert).toHaveBeenCalledWith(expect.objectContaining({ clientSecretEnc: null }));
    });
  });

  describe('fail closed when the encryption key is missing', () => {
    it('returns 503 with a typed executor_encryption_key_missing code', async () => {
      const encryption = createMockEncryption();
      encryption.encrypt.mockImplementation(() => {
        throw new ExecutorEncryptionKeyMissingError();
      });
      const server = createServer({ credentialEncryption: encryption });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(response.status).toBe(503);
      expect(response.body).toEqual(
        expect.objectContaining({ code: 'executor_encryption_key_missing' }),
      );
    });

    it('does not persist anything when the key is missing', async () => {
      const store = createMockStore();
      const encryption = createMockEncryption();
      encryption.encrypt.mockImplementation(() => {
        throw new ExecutorEncryptionKeyMissingError();
      });
      const server = createServer({
        mcpOAuthCredentialsStore: store,
        credentialEncryption: encryption,
      });
      const token = signToken({ id: 1 });

      await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(store.upsert).not.toHaveBeenCalled();
    });
  });

  describe('body validation', () => {
    it('returns 400 when the refresh token is missing', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 1 });
      const { refreshToken, ...noRefresh } = validBody;

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(noRefresh);

      expect(response.status).toBe(400);
      expect(store.upsert).not.toHaveBeenCalled();
    });

    it('returns 400 when mcpServerId is missing', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 1 });
      const { mcpServerId, ...noServer } = validBody;

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(noServer);

      expect(response.status).toBe(400);
      expect(store.upsert).not.toHaveBeenCalled();
    });

    it('returns 400 when tokenEndpoint is missing', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 1 });
      const { tokenEndpoint, ...noEndpoint } = validBody;

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(noEndpoint);

      expect(response.status).toBe(400);
      expect(store.upsert).not.toHaveBeenCalled();
    });

    it('returns 400 when a field has the wrong type', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBody, refreshToken: 12345 });

      expect(response.status).toBe(400);
      expect(store.upsert).not.toHaveBeenCalled();
    });

    it('returns 400 when clientSecretExpiresAt is not a parseable date', async () => {
      const store = createMockStore();
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBody, clientSecretExpiresAt: 'not-a-date' });

      expect(response.status).toBe(400);
      expect(store.upsert).not.toHaveBeenCalled();
    });
  });

  describe('store failure', () => {
    it('returns 500 when the store rejects', async () => {
      const store = createMockStore();
      store.upsert.mockRejectedValue(new Error('db down'));
      const server = createServer({ mcpOAuthCredentialsStore: store });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/mcp-oauth-credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(response.status).toBe(500);
    });
  });
});

describe('DELETE /mcp-oauth-credentials/:mcpServerId', () => {
  it('returns 401 when no token is provided', async () => {
    const server = createServer();

    const response = await request(server.callback).delete('/mcp-oauth-credentials/mcp-server-1');

    expect(response.status).toBe(401);
  });

  it('deletes the credential for (token user, mcpServerId) and returns 204 with no body', async () => {
    const store = createMockStore();
    const server = createServer({ mcpOAuthCredentialsStore: store });
    const token = signToken({ id: 7 });

    const response = await request(server.callback)
      .delete('/mcp-oauth-credentials/mcp-server-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(store.delete).toHaveBeenCalledWith(7, 'mcp-server-1');
  });

  it("does not delete another user's credential", async () => {
    const store = createMockStore();
    const server = createServer({ mcpOAuthCredentialsStore: store });
    const token = signToken({ id: 7 });

    await request(server.callback)
      .delete('/mcp-oauth-credentials/mcp-server-1')
      .set('Authorization', `Bearer ${token}`);

    expect(store.delete).not.toHaveBeenCalledWith(999, expect.anything());
  });

  it('returns 401 when the token carries no numeric id (rejected by the claims middleware)', async () => {
    const store = createMockStore();
    const server = createServer({ mcpOAuthCredentialsStore: store });
    const token = signToken({ email: 'no-id@example.com' });

    const response = await request(server.callback)
      .delete('/mcp-oauth-credentials/mcp-server-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(store.delete).not.toHaveBeenCalled();
  });
});
