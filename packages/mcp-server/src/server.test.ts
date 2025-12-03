import type * as http from 'http';

import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';

import ForestAdminMCPServer from './server.js';
import MockServer from './test-utils/mock-server.js';

function shutDownHttpServer(server: http.Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();

  return new Promise(resolve => {
    server.close(() => {
      resolve();
    });
  });
}

/**
 * Integration tests for ForestAdminMCPServer instance
 * Tests the actual server class and its behavior
 */
describe('ForestAdminMCPServer Instance', () => {
  let server: ForestAdminMCPServer;
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
      .get('/liana/environment', { data: { id: '12345' } })
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
      server = new ForestAdminMCPServer();

      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(ForestAdminMCPServer);
    });

    it('should initialize with FOREST_SERVER_URL', () => {
      process.env.FOREST_SERVER_URL = 'https://custom.forestadmin.com';
      server = new ForestAdminMCPServer();

      expect(server.forestServerUrl).toBe('https://custom.forestadmin.com');
    });

    it('should fallback to FOREST_URL', () => {
      delete process.env.FOREST_SERVER_URL;
      process.env.FOREST_URL = 'https://fallback.forestadmin.com';
      server = new ForestAdminMCPServer();

      expect(server.forestServerUrl).toBe('https://fallback.forestadmin.com');
    });

    it('should use default URL when neither is provided', () => {
      delete process.env.FOREST_SERVER_URL;
      delete process.env.FOREST_URL;
      server = new ForestAdminMCPServer();

      expect(server.forestServerUrl).toBe('https://api.forestadmin.com');
    });

    it('should create MCP server instance', () => {
      server = new ForestAdminMCPServer();

      expect(server.mcpServer).toBeDefined();
    });
  });

  describe('environment validation', () => {
    it('should throw error when FOREST_ENV_SECRET is missing', async () => {
      delete process.env.FOREST_ENV_SECRET;
      server = new ForestAdminMCPServer();

      await expect(server.run()).rejects.toThrow(
        'FOREST_ENV_SECRET environment variable is not set',
      );
    });

    it('should throw error when FOREST_AUTH_SECRET is missing', async () => {
      delete process.env.FOREST_AUTH_SECRET;
      server = new ForestAdminMCPServer();

      await expect(server.run()).rejects.toThrow(
        'FOREST_AUTH_SECRET environment variable is not set',
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

      server = new ForestAdminMCPServer();

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

      server = new ForestAdminMCPServer();
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

      server = new ForestAdminMCPServer();
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
        expect(response.body.grant_types_supported).toEqual(['authorization_code']);
        expect(response.body.code_challenge_methods_supported).toEqual(['S256']);
        expect(response.body.token_endpoint_auth_methods_supported).toEqual(['none']);
      });

      it('should return registration_endpoint with custom FOREST_SERVER_URL', async () => {
        // Clean up previous server
        await shutDownHttpServer(server?.httpServer as http.Server);

        process.env.FOREST_SERVER_URL = 'https://custom.forestadmin.com';
        process.env.MCP_SERVER_PORT = '39314';

        server = new ForestAdminMCPServer();
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
    let tokenServer: ForestAdminMCPServer;
    let tokenHttpServer: http.Server;
    let tokenMockServer: MockServer;

    beforeAll(async () => {
      process.env.FOREST_ENV_SECRET = 'test-env-secret';
      process.env.FOREST_AUTH_SECRET = 'test-auth-secret';
      process.env.FOREST_SERVER_URL = 'https://test.forestadmin.com';
      process.env.MCP_SERVER_PORT = '39320';

      // Setup mock for Forest Admin server API responses
      tokenMockServer = new MockServer();
      tokenMockServer
        .get('/liana/environment', { data: { id: '12345' } })
        .get(/\/oauth\/register\/registered-client/, {
          client_id: 'registered-client',
          redirect_uris: ['https://example.com/callback'],
          client_name: 'Test Client',
          scope: 'mcp:read mcp:write',
        })
        .get(/\/oauth\/register\//, { error: 'Client not found' }, 404)
        // Mock Forest Admin OAuth token endpoint - returns a valid JWT with renderingId
        .post('/oauth/token', {
          access_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZW5kZXJpbmdJZCI6NDU2LCJpYXQiOjE2MzAwMDAwMDB9.fake',
          refresh_token: 'forest-server-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'mcp:read',
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

      global.fetch = tokenMockServer.fetch;
      // Also mock superagent for forestadmin-client requests
      tokenMockServer.setupSuperagentMock();

      // Create and start server
      tokenServer = new ForestAdminMCPServer();
      tokenServer.run();

      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      tokenHttpServer = tokenServer.httpServer as http.Server;
    });

    afterAll(async () => {
      tokenMockServer.restoreSuperagent();
      await new Promise<void>(resolve => {
        if (tokenServer?.httpServer) {
          (tokenServer.httpServer as http.Server).close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('should return 400 when grant_type is missing', async () => {
      const response = await request(tokenHttpServer).post('/oauth/token').type('form').send({
        code: 'auth-code-123',
        redirect_uri: 'https://example.com/callback',
        client_id: 'registered-client',
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when code is missing', async () => {
      const response = await request(tokenHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'authorization_code',
        redirect_uri: 'https://example.com/callback',
        client_id: 'registered-client',
      });

      expect(response.status).toBe(400);
    });

    it('should call Forest Admin server to exchange code', async () => {
      tokenMockServer.clear();

      const response = await request(tokenHttpServer).post('/oauth/token').type('form').send({
        grant_type: 'authorization_code',
        code: 'valid-auth-code',
        redirect_uri: 'https://example.com/callback',
        client_id: 'registered-client',
        code_verifier: 'test-code-verifier',
      });

      expect(tokenMockServer.fetch).toHaveBeenCalledWith(
        'https://test.forestadmin.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"grant_type":"authorization_code"'),
        }),
      );
      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(3600);
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
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZW5kZXJpbmdJZCI6NDU2LCJpYXQiOjE2MzAwMDAwMDB9.fake',
      });
      // JWT should also have iat and exp claims
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });
});
