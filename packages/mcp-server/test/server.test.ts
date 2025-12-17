import type * as http from 'http';

import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';

import MockServer from './test-utils/mock-server';
import ForestMCPServer from '../src/server';

function shutDownHttpServer(server: http.Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();

  return new Promise(resolve => {
    server.close(() => {
      resolve();
    });
  });
}

/**
 * Integration tests for ForestMCPServer instance
 * Tests the actual server class and its behavior
 */
describe('ForestMCPServer Instance', () => {
  let server: ForestMCPServer;
  let originalEnv: NodeJS.ProcessEnv;
  let modifiedEnv: NodeJS.ProcessEnv;
  let mockServer: MockServer;
  const originalFetch = global.fetch;

  beforeAll(() => {
    originalEnv = { ...process.env };
    process.env.FOREST_ENV_SECRET = 'test-env-secret';
    process.env.FOREST_AUTH_SECRET = 'test-auth-secret';
    process.env.FOREST_SERVER_URL = 'https://test.forestadmin.com';
    process.env.AGENT_HOSTNAME = 'http://localhost:3310';

    // Setup mock for Forest Admin server
    mockServer = new MockServer();
    mockServer
      .get('/liana/environment', {
        data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
      })
      .get('/liana/forest-schema', {
        data: [
          {
            id: 'users',
            type: 'collections',
            attributes: { name: 'users', fields: [{ field: 'id', type: 'Number' }] },
          },
          {
            id: 'products',
            type: 'collections',
            attributes: { name: 'products', fields: [{ field: 'name', type: 'String' }] },
          },
        ],
        meta: { liana: 'forest-express-sequelize', liana_version: '9.0.0', liana_features: null },
      })
      .get(/\/oauth\/register\/registered-client/, {
        client_id: 'registered-client',
        redirect_uris: ['https://example.com/callback'],
        client_name: 'Test Client',
      })
      .get(/\/oauth\/register\//, { error: 'Client not found' }, 404);

    global.fetch = mockServer.fetch;
  });

  afterAll(async () => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    modifiedEnv = { ...process.env };
    mockServer.clear();
  });

  afterEach(async () => {
    process.env = modifiedEnv;
  });

  describe('constructor', () => {
    it('should create server instance', () => {
      server = new ForestMCPServer();

      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(ForestMCPServer);
    });

    it('should initialize with FOREST_SERVER_URL', () => {
      process.env.FOREST_SERVER_URL = 'https://custom.forestadmin.com';
      server = new ForestMCPServer();

      expect(server.forestServerUrl).toBe('https://custom.forestadmin.com');
    });

    it('should fallback to FOREST_URL', () => {
      delete process.env.FOREST_SERVER_URL;
      process.env.FOREST_URL = 'https://fallback.forestadmin.com';
      server = new ForestMCPServer();

      expect(server.forestServerUrl).toBe('https://fallback.forestadmin.com');
    });

    it('should use default URL when neither is provided', () => {
      delete process.env.FOREST_SERVER_URL;
      delete process.env.FOREST_URL;
      server = new ForestMCPServer();

      expect(server.forestServerUrl).toBe('https://api.forestadmin.com');
    });

    it('should create MCP server instance', () => {
      server = new ForestMCPServer();

      expect(server.mcpServer).toBeDefined();
    });
  });

  describe('environment validation', () => {
    it('should throw error when FOREST_ENV_SECRET is missing', async () => {
      delete process.env.FOREST_ENV_SECRET;
      server = new ForestMCPServer();

      await expect(server.run()).rejects.toThrow(
        'FOREST_ENV_SECRET is not set. Provide it via options.envSecret or FOREST_ENV_SECRET environment variable.',
      );
    });

    it('should throw error when FOREST_AUTH_SECRET is missing', async () => {
      delete process.env.FOREST_AUTH_SECRET;
      server = new ForestMCPServer();

      await expect(server.run()).rejects.toThrow(
        'FOREST_AUTH_SECRET is not set. Provide it via options.authSecret or FOREST_AUTH_SECRET environment variable.',
      );
    });
  });

  describe('run method', () => {
    afterEach(async () => {
      await shutDownHttpServer(server?.httpServer as http.Server);
    });

    it('should start server on specified port', async () => {
      const testPort = 39310; // Use a different port for testing
      process.env.MCP_SERVER_PORT = testPort.toString();

      server = new ForestMCPServer();

      // Start the server without awaiting (it runs indefinitely)
      server.run();

      // Wait a bit for the server to start
      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      // Verify the server is running by making a request
      const { httpServer } = server;
      expect(httpServer).toBeDefined();

      // Make a request to verify server is responding
      const response = await request(httpServer as http.Server)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

      expect(response.status).toBeDefined();
    });

    it('should create transport instance', async () => {
      const testPort = 39311;
      process.env.MCP_SERVER_PORT = testPort.toString();

      server = new ForestMCPServer();
      server.run();

      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      expect(server.mcpTransport).toBeDefined();
    });
  });

  describe('HTTP endpoint', () => {
    let httpServer: http.Server;

    beforeAll(async () => {
      const testPort = 39312;
      process.env.MCP_SERVER_PORT = testPort.toString();

      server = new ForestMCPServer();
      server.run();

      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      httpServer = server.httpServer as http.Server;
    });

    afterAll(async () => {
      await shutDownHttpServer(server?.httpServer as http.Server);
    });

    it('should handle POST requests to /mcp', async () => {
      const response = await request(httpServer)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });

      expect(response.status).not.toBe(404);
    });

    it('should reject GET requests', async () => {
      const response = await request(httpServer).get('/mcp');

      expect(response.status).toBe(405);
    });

    it('should handle CORS', async () => {
      const response = await request(httpServer)
        .post('/mcp')
        .set('Origin', 'https://example.com')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should return JSON-RPC error on transport failure', async () => {
      // Send invalid request
      const response = await request(httpServer).post('/mcp').send('invalid json');

      // Should handle the error gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    describe('OAuth metadata endpoint', () => {
      it('should return OAuth metadata at /.well-known/oauth-authorization-server', async () => {
        const response = await request(server.httpServer).get(
          '/.well-known/oauth-authorization-server',
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body.issuer).toBe('http://localhost:39312/');
        expect(response.body.registration_endpoint).toBe(
          'https://test.forestadmin.com/oauth/register',
        );
        expect(response.body.authorization_endpoint).toBe(`http://localhost:39312/oauth/authorize`);
        expect(response.body.token_endpoint).toBe(`http://localhost:39312/oauth/token`);
        expect(response.body.revocation_endpoint).toBeUndefined();
        expect(response.body.scopes_supported).toEqual([
          'mcp:read',
          'mcp:write',
          'mcp:action',
          'mcp:admin',
        ]);
        expect(response.body.response_types_supported).toEqual(['code']);
        expect(response.body.grant_types_supported).toEqual([
          'authorization_code',
          'refresh_token',
        ]);
        expect(response.body.code_challenge_methods_supported).toEqual(['S256']);
        expect(response.body.token_endpoint_auth_methods_supported).toEqual(['none']);
      });

      it('should return registration_endpoint with custom FOREST_SERVER_URL', async () => {
        // Clean up previous server
        await shutDownHttpServer(server?.httpServer as http.Server);

        process.env.FOREST_SERVER_URL = 'https://custom.forestadmin.com';
        process.env.MCP_SERVER_PORT = '39314';

        server = new ForestMCPServer();
        server.run();

        await new Promise(resolve => {
          setTimeout(resolve, 500);
        });

        const response = await request(server.httpServer).get(
          '/.well-known/oauth-authorization-server',
        );

        expect(response.body.registration_endpoint).toBe(
          'https://custom.forestadmin.com/oauth/register',
        );
      });
    });

    describe('/oauth/authorize endpoint', () => {
      it('should return 400 when required parameters are missing', async () => {
        const response = await request(httpServer).get('/oauth/authorize');

        expect(response.status).toBe(400);
      });

      it('should return 400 when client_id is missing', async () => {
        const response = await request(httpServer).get('/oauth/authorize').query({
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
        });

        expect(response.status).toBe(400);
      });

      it('should return 400 when redirect_uri is missing', async () => {
        const response = await request(httpServer).get('/oauth/authorize').query({
          client_id: 'test-client',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
        });

        expect(response.status).toBe(400);
      });

      it('should return 400 when code_challenge is missing', async () => {
        const response = await request(httpServer).get('/oauth/authorize').query({
          client_id: 'test-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge_method: 'S256',
          state: 'test-state',
        });

        expect(response.status).toBe(400);
      });

      it('should return 400 when client is not registered', async () => {
        const response = await request(httpServer).get('/oauth/authorize').query({
          client_id: 'unregistered-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
          scope: 'mcp:read',
        });

        expect(response.status).toBe(400);
      });

      it('should redirect to Forest Admin frontend with correct parameters', async () => {
        const response = await request(httpServer).get('/oauth/authorize').query({
          client_id: 'registered-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
          scope: 'mcp:read profile',
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('https://app.forestadmin.com/oauth/authorize');

        const redirectUrl = new URL(response.headers.location);
        expect(redirectUrl.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
        expect(redirectUrl.searchParams.get('code_challenge')).toBe('test-challenge');
        expect(redirectUrl.searchParams.get('code_challenge_method')).toBe('S256');
        expect(redirectUrl.searchParams.get('response_type')).toBe('code');
        expect(redirectUrl.searchParams.get('client_id')).toBe('registered-client');
        expect(redirectUrl.searchParams.get('state')).toBe('test-state');
        expect(redirectUrl.searchParams.get('scope')).toBe('mcp:read+profile');
        expect(redirectUrl.searchParams.get('environmentId')).toBe('12345');
      });

      it('should redirect to default frontend when FOREST_FRONTEND_HOSTNAME is not set', async () => {
        const response = await request(httpServer).get('/oauth/authorize').query({
          client_id: 'registered-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
          scope: 'mcp:read',
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('https://app.forestadmin.com/oauth/authorize');
      });

      it('should handle POST method for authorize', async () => {
        // POST /authorize uses form-encoded body
        const response = await request(httpServer).post('/oauth/authorize').type('form').send({
          client_id: 'registered-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
          scope: 'mcp:read',
          resource: 'https://example.com/resource',
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toStrictEqual(
          `https://app.forestadmin.com/oauth/authorize?redirect_uri=${encodeURIComponent(
            'https://example.com/callback',
          )}&code_challenge=test-challenge&code_challenge_method=S256&response_type=code&client_id=registered-client&state=test-state&scope=${encodeURIComponent(
            'mcp:read',
          )}&resource=${encodeURIComponent('https://example.com/resource')}&environmentId=12345`,
        );
      });
    });
  });

  /**
   * Integration tests for /oauth/token endpoint
   * Uses a separate server instance with mock server for Forest Admin API
   */
  describe('/oauth/token endpoint', () => {
    let mcpServer: ForestMCPServer;
    let mcpHttpServer: http.Server;
    let mcpMockServer: MockServer;

    beforeAll(async () => {
      process.env.FOREST_ENV_SECRET = 'test-env-secret';
      process.env.FOREST_AUTH_SECRET = 'test-auth-secret';
      process.env.FOREST_SERVER_URL = 'https://test.forestadmin.com';
      process.env.MCP_SERVER_PORT = '39320';

      // Setup mock for Forest Admin server API responses
      mcpMockServer = new MockServer();
      mcpMockServer
        .get('/liana/environment', {
          data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
        })
        .get('/liana/forest-schema', {
          data: [
            {
              id: 'users',
              type: 'collections',
              attributes: { name: 'users', fields: [{ field: 'id', type: 'Number' }] },
            },
            {
              id: 'products',
              type: 'collections',
              attributes: { name: 'products', fields: [{ field: 'name', type: 'String' }] },
            },
          ],
          meta: { liana: 'forest-express-sequelize', liana_version: '9.0.0', liana_features: null },
        })
        .get(/\/oauth\/register\/registered-client/, {
          client_id: 'registered-client',
          redirect_uris: ['https://example.com/callback'],
          client_name: 'Test Client',
          scope: 'mcp:read mcp:write',
        })
        .get(/\/oauth\/register\//, { error: 'Client not found' }, 404)
        // Mock Forest Admin OAuth token endpoint - returns valid JWTs with meta.renderingId, exp, iat, scope
        // access_token JWT payload: { meta: { renderingId: 456 }, scope: 'mcp:read mcp:write', iat: 2524608000, exp: 2524611600 }
        // refresh_token JWT payload: { iat: 2524608000, exp: 2525212800 }
        .post('/oauth/token', {
          access_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXRhIjp7InJlbmRlcmluZ0lkIjo0NTZ9LCJzY29wZSI6Im1jcDpyZWFkIG1jcDp3cml0ZSIsImlhdCI6MjUyNDYwODAwMCwiZXhwIjoyNTI0NjExNjAwfQ.fake',
          refresh_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjI1MjQ2MDgwMDAsImV4cCI6MjUyNTIxMjgwMH0.fake',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'mcp:read mcp:write',
        })
        // Mock Forest Admin user info endpoint (called by forestadmin-client via superagent)
        .get(/\/liana\/v2\/renderings\/\d+\/authorization/, {
          data: {
            id: '123',
            attributes: {
              email: 'user@example.com',
              first_name: 'Test',
              last_name: 'User',
              teams: ['Operations'],
              role: 'Admin',
              permission_level: 'admin',
              tags: [],
            },
          },
        });

      global.fetch = mcpMockServer.fetch;
      // Also mock superagent for forestadmin-client requests
      mcpMockServer.setupSuperagentMock();

      // Create and start server
      mcpServer = new ForestMCPServer();
      mcpServer.run();

      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      mcpHttpServer = mcpServer.httpServer as http.Server;
    });

    afterAll(async () => {
      mcpMockServer.restoreSuperagent();
      await new Promise<void>(resolve => {
        if (mcpServer?.httpServer) {
          (mcpServer.httpServer as http.Server).close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('should return 400 when grant_type is missing', async () => {
      const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
        code: 'auth-code-123',
        redirect_uri: 'https://example.com/callback',
        client_id: 'registered-client',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should return 400 when code is missing', async () => {
      const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'authorization_code',
        redirect_uri: 'https://example.com/callback',
        client_id: 'registered-client',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should call Forest Admin server to exchange code', async () => {
      mcpMockServer.clear();

      const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'authorization_code',
        code: 'valid-auth-code',
        redirect_uri: 'https://example.com/callback',
        client_id: 'registered-client',
        code_verifier: 'test-code-verifier',
      });

      expect(mcpMockServer.fetch).toHaveBeenCalledWith(
        'https://test.forestadmin.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"grant_type":"authorization_code"'),
        }),
      );
      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
      // expires_in is calculated as exp - now from the JWT, so it's a large value for our test tokens
      expect(response.body.expires_in).toBeGreaterThan(0);
      // The scope is returned from the decoded forest token
      expect(response.body.scope).toBe('mcp:read mcp:write');
      const accessToken = response.body.access_token as string;
      expect(
        () =>
          jsonwebtoken.verify(accessToken, process.env.FOREST_AUTH_SECRET) as {
            renderingId: number;
          },
      ).not.toThrow();
      // The forestadmin-client transforms the response from the API
      // (e.g., first_name → firstName, id string → number, teams[0] → team)
      const decoded = jsonwebtoken.decode(accessToken) as Record<string, unknown>;
      expect(decoded).toMatchObject({
        id: 123,
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        team: 'Operations',
        role: 'Admin',
        permissionLevel: 'admin',
        renderingId: 456,
        tags: {},
        serverToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXRhIjp7InJlbmRlcmluZ0lkIjo0NTZ9LCJzY29wZSI6Im1jcDpyZWFkIG1jcDp3cml0ZSIsImlhdCI6MjUyNDYwODAwMCwiZXhwIjoyNTI0NjExNjAwfQ.fake',
      });
      // JWT should also have iat and exp claims
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();

      // Verify refresh token structure
      const refreshToken = response.body.refresh_token as string;
      const decodedRefreshToken = jsonwebtoken.decode(refreshToken) as Record<string, unknown>;
      expect(decodedRefreshToken).toMatchObject({
        type: 'refresh',
        clientId: 'registered-client',
        userId: 123,
        renderingId: 456,
        // The serverRefreshToken is the JWT returned from Forest Admin
        serverRefreshToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjI1MjQ2MDgwMDAsImV4cCI6MjUyNTIxMjgwMH0.fake',
      });
    });

    it('should exchange refresh token for new tokens', async () => {
      mcpMockServer.clear();

      // First, get initial tokens
      const initialResponse = await request(mcpHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'authorization_code',
        code: 'valid-auth-code',
        redirect_uri: 'https://example.com/callback',
        client_id: 'registered-client',
        code_verifier: 'test-code-verifier',
      });

      expect(initialResponse.status).toBe(200);
      const refreshToken = initialResponse.body.refresh_token as string;

      // Clear mock to track new calls
      mcpMockServer.clear();

      // Now exchange refresh token for new tokens
      const refreshResponse = await request(mcpHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'registered-client',
      });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.access_token).toBeDefined();
      expect(refreshResponse.body.refresh_token).toBeDefined();
      expect(refreshResponse.body.token_type).toBe('Bearer');
      // expires_in is calculated as exp - now from the JWT (duration in seconds)
      expect(refreshResponse.body.expires_in).toBeGreaterThan(0);

      // Verify the new access token is valid
      const newAccessToken = refreshResponse.body.access_token as string;
      expect(() =>
        jsonwebtoken.verify(newAccessToken, process.env.FOREST_AUTH_SECRET),
      ).not.toThrow();

      // Verify token rotation: new refresh token is returned
      const newRefreshToken = refreshResponse.body.refresh_token as string;
      expect(newRefreshToken).toBeDefined();
      // Verify it's a valid JWT with refresh token structure
      const decodedNewRefresh = jsonwebtoken.decode(newRefreshToken) as Record<string, unknown>;
      expect(decodedNewRefresh.type).toBe('refresh');
      expect(decodedNewRefresh.clientId).toBe('registered-client');

      // Verify Forest Admin token endpoint was called with refresh_token grant
      expect(mcpMockServer.fetch).toHaveBeenCalledWith(
        'https://test.forestadmin.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"grant_type":"refresh_token"'),
        }),
      );

      // Note: Token rotation is implemented - the new refresh token should be different
      // However, since both requests use the same mock returning the same forest-server-refresh-token,
      // the generated JWT will have similar claims but different iat/exp timestamps
      const oldDecoded = jsonwebtoken.decode(refreshToken) as { iat: number; exp: number };
      const newDecoded = jsonwebtoken.decode(newRefreshToken) as { iat: number; exp: number };
      expect(newDecoded.iat).toBeGreaterThanOrEqual(oldDecoded.iat);
    });

    it('should return 400 for invalid refresh token', async () => {
      const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'refresh_token',
        refresh_token: 'invalid-token',
        client_id: 'registered-client',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when refresh_token is missing for refresh_token grant', async () => {
      const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'refresh_token',
        client_id: 'registered-client',
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when client_id does not match refresh token', async () => {
      // Create a refresh token for a different client
      const refreshToken = jsonwebtoken.sign(
        {
          type: 'refresh',
          clientId: 'different-client',
          userId: 123,
          renderingId: 456,
          serverRefreshToken: 'forest-refresh-token',
        },
        process.env.FOREST_AUTH_SECRET,
        { expiresIn: '7d' },
      );

      const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'registered-client',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    describe('error handling', () => {
      const setupErrorMock = (errorResponse: object, statusCode: number) => {
        mcpMockServer.reset();
        mcpMockServer
          .get('/liana/environment', {
            data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
          })
          .get('/liana/forest-schema', {
            data: [
              {
                id: 'users',
                type: 'collections',
                attributes: { name: 'users', fields: [{ field: 'id', type: 'Number' }] },
              },
            ],
            meta: {
              liana: 'forest-express-sequelize',
              liana_version: '9.0.0',
              liana_features: null,
            },
          })
          .get(/\/oauth\/register\/registered-client/, {
            client_id: 'registered-client',
            redirect_uris: ['https://example.com/callback'],
            client_name: 'Test Client',
            scope: 'mcp:read mcp:write',
          })
          .get(/\/oauth\/register\//, { error: 'Client not found' }, 404)
          .post('/oauth/token', errorResponse, statusCode);
      };

      // Note: The implementation wraps all OAuth errors in InvalidRequestError,
      // so the error code is always 'invalid_request' with the original error in the description

      it('should return error when authorization code is invalid', async () => {
        setupErrorMock(
          {
            error: 'invalid_grant',
            error_description: 'The authorization code has expired or is invalid',
          },
          400,
        );

        const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
          grant_type: 'authorization_code',
          code: 'expired-or-invalid-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'registered-client',
          code_verifier: 'test-code-verifier',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('invalid_request');
        expect(response.body.error_description).toContain('Failed to exchange authorization code');
      });

      it('should return error when client authentication fails', async () => {
        setupErrorMock(
          {
            error: 'invalid_client',
            error_description: 'Client authentication failed',
          },
          401,
        );

        const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
          grant_type: 'authorization_code',
          code: 'some-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'registered-client',
          code_verifier: 'test-code-verifier',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('invalid_request');
        expect(response.body.error_description).toContain('Failed to exchange authorization code');
      });

      it('should return error when requested scope is invalid', async () => {
        setupErrorMock(
          {
            error: 'invalid_scope',
            error_description: 'The requested scope is invalid or unknown',
          },
          400,
        );

        const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
          grant_type: 'authorization_code',
          code: 'some-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'registered-client',
          code_verifier: 'test-code-verifier',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('invalid_request');
        expect(response.body.error_description).toContain('Failed to exchange authorization code');
      });

      it('should return error when client is not authorized', async () => {
        setupErrorMock(
          {
            error: 'unauthorized_client',
            error_description: 'The client is not authorized to use this grant type',
          },
          403,
        );

        const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
          grant_type: 'authorization_code',
          code: 'some-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'registered-client',
          code_verifier: 'test-code-verifier',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('invalid_request');
        expect(response.body.error_description).toContain('Failed to exchange authorization code');
      });

      it('should return error when Forest Admin server has internal error', async () => {
        setupErrorMock(
          {
            error: 'server_error',
            error_description: 'An unexpected error occurred on the server',
          },
          500,
        );

        const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
          grant_type: 'authorization_code',
          code: 'some-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'registered-client',
          code_verifier: 'test-code-verifier',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('invalid_request');
        expect(response.body.error_description).toContain('Failed to exchange authorization code');
      });

      it('should use default error description when not provided by Forest server', async () => {
        setupErrorMock({ error: 'invalid_request' }, 400);

        const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
          grant_type: 'authorization_code',
          code: 'some-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'registered-client',
          code_verifier: 'test-code-verifier',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('invalid_request');
        expect(response.body.error_description).toContain('Failed to exchange authorization code');
      });

      it('should return error when Forest server returns error without error code', async () => {
        setupErrorMock({ message: 'Something went wrong' }, 500);

        const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
          grant_type: 'authorization_code',
          code: 'some-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'registered-client',
          code_verifier: 'test-code-verifier',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('invalid_request');
        expect(response.body.error_description).toContain('Failed to exchange authorization code');
      });
    });
  });

  /**
   * Integration tests for the list tool
   * Tests that the list tool is properly registered and accessible
   */
  describe('List tool integration', () => {
    let listServer: ForestMCPServer;
    let listHttpServer: http.Server;
    let listMockServer: MockServer;

    beforeAll(async () => {
      process.env.FOREST_ENV_SECRET = 'test-env-secret';
      process.env.FOREST_AUTH_SECRET = 'test-auth-secret';
      process.env.FOREST_SERVER_URL = 'https://test.forestadmin.com';
      process.env.AGENT_HOSTNAME = 'http://localhost:3310';
      process.env.MCP_SERVER_PORT = '39330';

      listMockServer = new MockServer();
      listMockServer
        .get('/liana/environment', {
          data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
        })
        .get('/liana/forest-schema', {
          data: [
            {
              id: 'users',
              type: 'collections',
              attributes: { name: 'users', fields: [{ field: 'id', type: 'Number' }] },
            },
            {
              id: 'products',
              type: 'collections',
              attributes: { name: 'products', fields: [{ field: 'name', type: 'String' }] },
            },
          ],
          meta: { liana: 'forest-express-sequelize', liana_version: '9.0.0', liana_features: null },
        })
        .get(/\/oauth\/register\/registered-client/, {
          client_id: 'registered-client',
          redirect_uris: ['https://example.com/callback'],
          client_name: 'Test Client',
          scope: 'mcp:read mcp:write',
        })
        .get(/\/oauth\/register\//, { error: 'Client not found' }, 404);

      global.fetch = listMockServer.fetch;
      // Setup superagent mock for agent-client RPC calls
      listMockServer.setupSuperagentMock();

      listServer = new ForestMCPServer();
      listServer.run();

      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      listHttpServer = listServer.httpServer as http.Server;
    });

    afterAll(async () => {
      listMockServer.restoreSuperagent();
      await new Promise<void>(resolve => {
        if (listServer?.httpServer) {
          (listServer.httpServer as http.Server).close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('should have list tool registered in the MCP server', () => {
      expect(listServer.mcpServer).toBeDefined();
      // The tool should be registered during server initialization
      // We verify this by checking the server started successfully
      expect(listHttpServer).toBeDefined();
    });

    it('should require authentication to access /mcp endpoint', async () => {
      const response = await request(listHttpServer).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      });

      // Without a valid bearer token, we should get an authentication error
      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid bearer token', async () => {
      const response = await request(listHttpServer)
        .post('/mcp')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      expect(response.status).toBe(401);
    });

    it('should accept requests with valid bearer token and list available tools', async () => {
      // Create a valid JWT token
      const authSecret = process.env.FOREST_AUTH_SECRET || 'test-auth-secret';
      const validToken = jsonwebtoken.sign(
        {
          id: 123,
          email: 'user@example.com',
          renderingId: 456,
        },
        authSecret,
        { expiresIn: '1h' },
      );

      const response = await request(listHttpServer)
        .post('/mcp')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      expect(response.status).toBe(200);

      // The MCP SDK returns the response as text that needs to be parsed
      // The response may be in JSON-RPC format or as a newline-delimited JSON stream
      let responseData: {
        jsonrpc: string;
        id: number;
        result: {
          tools: Array<{
            name: string;
            description: string;
            inputSchema: { properties: Record<string, unknown> };
          }>;
        };
      };

      if (response.body && Object.keys(response.body).length > 0) {
        responseData = response.body;
      } else {
        // Parse the text response - MCP returns Server-Sent Events format with "data: " prefix
        const textResponse = response.text;
        const lines = textResponse.split('\n').filter((line: string) => line.trim());
        // Find the line with the actual JSON-RPC response (starts with "data: ")
        const dataLine = lines.find((line: string) => line.startsWith('data: '));

        if (dataLine) {
          responseData = JSON.parse(dataLine.replace('data: ', ''));
        } else {
          responseData = JSON.parse(lines[lines.length - 1]);
        }
      }

      expect(responseData.jsonrpc).toBe('2.0');
      expect(responseData.id).toBe(1);
      expect(responseData.result).toBeDefined();
      expect(responseData.result.tools).toBeDefined();
      expect(Array.isArray(responseData.result.tools)).toBe(true);

      // Verify the 'list' tool is registered
      const listTool = responseData.result.tools.find(
        (tool: { name: string }) => tool.name === 'list',
      );
      expect(listTool).toBeDefined();
      expect(listTool.description).toBe(
        'Retrieve a list of records from the specified collection.',
      );
      expect(listTool.inputSchema).toBeDefined();
      expect(listTool.inputSchema.properties).toHaveProperty('collectionName');
      expect(listTool.inputSchema.properties).toHaveProperty('search');
      expect(listTool.inputSchema.properties).toHaveProperty('filters');
      expect(listTool.inputSchema.properties).toHaveProperty('sort');

      // Verify collectionName has enum with the collection names from the mocked schema
      const collectionNameSchema = listTool.inputSchema.properties.collectionName as {
        type: string;
        enum?: string[];
      };
      expect(collectionNameSchema.type).toBe('string');
      expect(collectionNameSchema.enum).toBeDefined();
      expect(collectionNameSchema.enum).toEqual(['users', 'products']);
    });

    it('should create activity log with forestServerToken when calling list tool', async () => {
      // This test verifies that the activity log API is called with the forestServerToken
      // (the original Forest server token) and NOT the MCP JWT token.
      // The forestServerToken is embedded in the MCP JWT during token exchange and extracted
      // by verifyAccessToken into authInfo.extra.forestServerToken

      const authSecret = process.env.FOREST_AUTH_SECRET || 'test-auth-secret';
      const forestServerToken = 'original-forest-server-token-for-activity-log';

      // Create MCP JWT with embedded serverToken (as done during OAuth token exchange)
      const mcpToken = jsonwebtoken.sign(
        {
          id: 123,
          email: 'user@example.com',
          renderingId: 456,
          serverToken: forestServerToken,
        },
        authSecret,
        { expiresIn: '1h' },
      );

      // Setup mock to capture the activity log API call and mock agent response
      listMockServer.clear();
      listMockServer
        .post('/api/activity-logs-requests', { success: true })
        .post('/forest/rpc', { result: [{ id: 1, name: 'Test' }] });

      const response = await request(listHttpServer)
        .post('/mcp')
        .set('Authorization', `Bearer ${mcpToken}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'list',
            arguments: { collectionName: 'users' },
          },
          id: 2,
        });

      // The tool call should succeed (or fail on agent call, but activity log should be created first)
      expect(response.status).toBe(200);

      // Verify activity log API was called with the correct forestServerToken
      // The mock fetch captures all calls as [url, options] tuples
      const activityLogCall = listMockServer.fetch.mock.calls.find(
        (call: [string, RequestInit]) =>
          call[0] === 'https://test.forestadmin.com/api/activity-logs-requests',
      ) as [string, RequestInit] | undefined;

      expect(activityLogCall).toBeDefined();
      expect(activityLogCall![1].headers).toMatchObject({
        Authorization: `Bearer ${forestServerToken}`,
        'Content-Type': 'application/json',
        'Forest-Application-Source': 'MCP',
      });

      // Verify the body contains the correct data
      const body = JSON.parse(activityLogCall![1].body as string);
      expect(body.data.attributes.action).toBe('index');
      expect(body.data.relationships.collection.data).toEqual({
        id: 'users',
        type: 'collections',
      });
    });

    it('should include shouldSearchInRelation and fields in list tool schema', async () => {
      const authSecret = process.env.FOREST_AUTH_SECRET || 'test-auth-secret';
      const validToken = jsonwebtoken.sign(
        {
          id: 123,
          email: 'user@example.com',
          renderingId: 456,
        },
        authSecret,
        { expiresIn: '1h' },
      );

      const response = await request(listHttpServer)
        .post('/mcp')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 6,
        });

      expect(response.status).toBe(200);

      // Parse the response
      let responseData: {
        result: {
          tools: Array<{
            name: string;
            inputSchema: { properties: Record<string, unknown> };
          }>;
        };
      };

      if (response.body && Object.keys(response.body).length > 0) {
        responseData = response.body;
      } else {
        const textResponse = response.text;
        const lines = textResponse.split('\n').filter((line: string) => line.trim());
        const dataLine = lines.find((line: string) => line.startsWith('data: '));

        if (dataLine) {
          responseData = JSON.parse(dataLine.replace('data: ', ''));
        } else {
          responseData = JSON.parse(lines[lines.length - 1]);
        }
      }

      const listTool = responseData.result.tools.find(
        (tool: { name: string }) => tool.name === 'list',
      );
      expect(listTool).toBeDefined();

      // Verify shouldSearchInRelation is in the schema
      expect(listTool.inputSchema.properties).toHaveProperty('shouldSearchInRelation');
      const shouldSearchInRelationSchema = listTool.inputSchema.properties
        .shouldSearchInRelation as {
        type: string;
        description?: string;
      };
      expect(shouldSearchInRelationSchema.type).toBe('boolean');
      expect(shouldSearchInRelationSchema.description).toContain('related collections');

      // Verify fields is in the schema
      expect(listTool.inputSchema.properties).toHaveProperty('fields');
      const fieldsSchema = listTool.inputSchema.properties.fields as {
        type: string;
        description?: string;
      };
      expect(fieldsSchema.type).toBe('array');
      expect(fieldsSchema.description).toContain('@@@');
      expect(fieldsSchema.description).toContain('relationName@@@fieldName');
    });
  });

  describe('Logging', () => {
    let loggingServer: ForestMCPServer;
    let loggingHttpServer: http.Server;
    let loggingMockServer: MockServer;
    let mockLogger: jest.Mock;

    beforeAll(async () => {
      process.env.FOREST_ENV_SECRET = 'test-env-secret';
      process.env.FOREST_AUTH_SECRET = 'test-auth-secret';
      process.env.FOREST_SERVER_URL = 'https://test.forestadmin.com';
      process.env.AGENT_HOSTNAME = 'http://localhost:3310';
      process.env.MCP_SERVER_PORT = '39331';

      loggingMockServer = new MockServer();
      loggingMockServer
        .get('/liana/environment', {
          data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
        })
        .get('/liana/forest-schema', {
          data: [
            {
              id: 'users',
              type: 'collections',
              attributes: { name: 'users', fields: [{ field: 'id', type: 'Number' }] },
            },
          ],
          meta: { liana: 'forest-express-sequelize', liana_version: '9.0.0', liana_features: null },
        })
        .get(/\/oauth\/register\/registered-client/, {
          client_id: 'registered-client',
          redirect_uris: ['https://example.com/callback'],
          client_name: 'Test Client',
          scope: 'mcp:read mcp:write',
        })
        .get(/\/oauth\/register\//, { error: 'Client not found' }, 404);

      global.fetch = loggingMockServer.fetch;

      mockLogger = jest.fn();
      loggingServer = new ForestMCPServer({ logger: mockLogger });
      loggingServer.run();

      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      loggingHttpServer = loggingServer.httpServer as http.Server;
    });

    afterAll(async () => {
      await new Promise<void>(resolve => {
        if (loggingServer?.httpServer) {
          (loggingServer.httpServer as http.Server).close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    beforeEach(() => {
      mockLogger.mockClear();
    });

    it('should log incoming request at the start of /mcp processing', async () => {
      const authSecret = process.env.FOREST_AUTH_SECRET || 'test-auth-secret';
      const validToken = jsonwebtoken.sign(
        { id: 123, email: 'user@example.com', renderingId: 456 },
        authSecret,
        { expiresIn: '1h' },
      );

      await request(loggingHttpServer)
        .post('/mcp')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

      expect(mockLogger).toHaveBeenCalledWith('Info', '[MCP] Incoming POST /mcp');
    });

    it('should log tool calls with safe parameters', async () => {
      const authSecret = process.env.FOREST_AUTH_SECRET || 'test-auth-secret';
      const validToken = jsonwebtoken.sign(
        { id: 123, email: 'user@example.com', renderingId: 456, serverToken: 'test-token' },
        authSecret,
        { expiresIn: '1h' },
      );

      loggingMockServer
        .post('/api/activity-logs-requests', { success: true })
        .post('/forest/rpc', { result: [{ id: 1, name: 'Test' }] });

      await request(loggingHttpServer)
        .post('/mcp')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list', arguments: { collectionName: 'users', search: 'secret' } },
          id: 2,
        });

      // Should log the tool call with only safe arguments (collectionName, not search)
      expect(mockLogger).toHaveBeenCalledWith(
        'Info',
        '[MCP] Tool call: list - params: {"collectionName":"users"}',
      );
    });

    it('should log tool errors from SSE response', async () => {
      const authSecret = process.env.FOREST_AUTH_SECRET || 'test-auth-secret';
      const validToken = jsonwebtoken.sign(
        { id: 123, email: 'user@example.com', renderingId: 456, serverToken: 'test-token' },
        authSecret,
        { expiresIn: '1h' },
      );

      // Mock agent to return an error
      loggingMockServer
        .post('/api/activity-logs-requests', { success: true })
        .post('/forest/rpc', { error: 'Collection not found' }, 400);

      await request(loggingHttpServer)
        .post('/mcp')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list', arguments: { collectionName: 'nonexistent' } },
          id: 3,
        });

      // Should log the error from the tool response
      expect(mockLogger).toHaveBeenCalledWith('Error', expect.stringContaining('[MCP]'));
    });

    it('should log HTTP response at the end with status and duration', async () => {
      const authSecret = process.env.FOREST_AUTH_SECRET || 'test-auth-secret';
      const validToken = jsonwebtoken.sign(
        { id: 123, email: 'user@example.com', renderingId: 456 },
        authSecret,
        { expiresIn: '1h' },
      );

      await request(loggingHttpServer)
        .post('/mcp')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

      // Should log HTTP response with status code and duration
      expect(mockLogger).toHaveBeenCalledWith(
        'Info',
        expect.stringMatching(/\[200\] POST \/mcp - \d+ms/),
      );
    });

    it('should log in correct order: incoming, tool call, response', async () => {
      const authSecret = process.env.FOREST_AUTH_SECRET || 'test-auth-secret';
      const validToken = jsonwebtoken.sign(
        { id: 123, email: 'user@example.com', renderingId: 456, serverToken: 'test-token' },
        authSecret,
        { expiresIn: '1h' },
      );

      loggingMockServer
        .post('/api/activity-logs-requests', { success: true })
        .post('/forest/rpc', { result: [{ id: 1 }] });

      await request(loggingHttpServer)
        .post('/mcp')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list', arguments: { collectionName: 'users' } },
          id: 4,
        });

      const calls = mockLogger.mock.calls;
      const incomingIndex = calls.findIndex(
        (c: [string, string]) => c[1] === '[MCP] Incoming POST /mcp',
      );
      const toolCallIndex = calls.findIndex((c: [string, string]) =>
        c[1].includes('[MCP] Tool call: list'),
      );
      const responseIndex = calls.findIndex((c: [string, string]) =>
        c[1].match(/\[200\] POST \/mcp/),
      );

      expect(incomingIndex).toBeGreaterThanOrEqual(0);
      expect(toolCallIndex).toBeGreaterThan(incomingIndex);
      expect(responseIndex).toBeGreaterThan(toolCallIndex);
    });
  });
});
