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
    let mcpServer: ForestAdminMCPServer;
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
        // Mock Forest Admin OAuth token endpoint - returns a valid JWT with meta.renderingId
        .post('/oauth/token', {
          access_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXRhIjp7InJlbmRlcmluZ0lkIjo0NTZ9LCJleHBpcmVzX2luIjozNjAwLCJzY29wZSI6Im1jcDpyZWFkIiwiaWF0IjoxNjMwMDAwMDAwfQ.fake',
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

      global.fetch = mcpMockServer.fetch;
      // Also mock superagent for forestadmin-client requests
      mcpMockServer.setupSuperagentMock();

      // Create and start server
      mcpServer = new ForestAdminMCPServer();
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
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(3600);
      // The scope is returned from the decoded forest token
      expect(response.body.scope).toBe('mcp:read');
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
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXRhIjp7InJlbmRlcmluZ0lkIjo0NTZ9LCJleHBpcmVzX2luIjozNjAwLCJzY29wZSI6Im1jcDpyZWFkIiwiaWF0IjoxNjMwMDAwMDAwfQ.fake',
      });
      // JWT should also have iat and exp claims
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
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

      it('should return invalid_grant error when authorization code is invalid', async () => {
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
        expect(response.body.error).toBe('invalid_grant');
        expect(response.body.error_description).toBe(
          'The authorization code has expired or is invalid',
        );
      });

      it('should return invalid_client error when client authentication fails', async () => {
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
        expect(response.body.error).toBe('invalid_client');
        expect(response.body.error_description).toBe('Client authentication failed');
      });

      it('should return invalid_scope error when requested scope is invalid', async () => {
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
        expect(response.body.error).toBe('invalid_scope');
        expect(response.body.error_description).toBe('The requested scope is invalid or unknown');
      });

      it('should return unauthorized_client error when client is not authorized', async () => {
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
        expect(response.body.error).toBe('unauthorized_client');
        expect(response.body.error_description).toBe(
          'The client is not authorized to use this grant type',
        );
      });

      it('should return server_error when Forest Admin server has internal error', async () => {
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
        expect(response.body.error).toBe('server_error');
        expect(response.body.error_description).toBe('An unexpected error occurred on the server');
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
        expect(response.body.error_description).toBe('Failed to exchange authorization code');
      });

      it('should use server_error when Forest server returns error without error code', async () => {
        setupErrorMock({ message: 'Something went wrong' }, 500);

        const response = await request(mcpHttpServer).post('/oauth/token').type('form').send({
          grant_type: 'authorization_code',
          code: 'some-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'registered-client',
          code_verifier: 'test-code-verifier',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('server_error');
        expect(response.body.error_description).toBe('Failed to exchange authorization code');
      });
    });
  });

  /**
   * Integration tests for the list tool
   * Tests that the list tool is properly registered and accessible
   */
  describe('List tool integration', () => {
    let listServer: ForestAdminMCPServer;
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

      listServer = new ForestAdminMCPServer();
      listServer.run();

      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      listHttpServer = listServer.httpServer as http.Server;
    });

    afterAll(async () => {
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
  });
});
