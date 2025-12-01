import type * as http from 'http';

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

    describe('/authorize endpoint', () => {
      it('should return 400 when required parameters are missing', async () => {
        const response = await request(httpServer).get('/authorize');

        expect(response.status).toBe(400);
      });

      it('should return 400 when client_id is missing', async () => {
        const response = await request(httpServer).get('/authorize').query({
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
        });

        expect(response.status).toBe(400);
      });

      it('should return 400 when redirect_uri is missing', async () => {
        const response = await request(httpServer).get('/authorize').query({
          client_id: 'test-client',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
        });

        expect(response.status).toBe(400);
      });

      it('should return 400 when code_challenge is missing', async () => {
        const response = await request(httpServer).get('/authorize').query({
          client_id: 'test-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge_method: 'S256',
          state: 'test-state',
        });

        expect(response.status).toBe(400);
      });

      it('should return 400 when client is not registered', async () => {
        const response = await request(httpServer).get('/authorize').query({
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
        const response = await request(httpServer).get('/authorize').query({
          client_id: 'registered-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
          scope: 'mcp:read profile',
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain(
          'https://app.forestadmin.com/authentication/mcp-login',
        );

        const redirectUrl = new URL(response.headers.location);
        expect(redirectUrl.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
        expect(redirectUrl.searchParams.get('code_challenge')).toBe('test-challenge');
        expect(redirectUrl.searchParams.get('client_id')).toBe('registered-client');
        expect(redirectUrl.searchParams.get('state')).toBe('test-state');
        expect(redirectUrl.searchParams.get('scope')).toBe('mcp:read+profile');
        expect(redirectUrl.searchParams.get('environmentId')).toBe('12345');
      });

      it('should redirect to default frontend when FOREST_FRONTEND_HOSTNAME is not set', async () => {
        const response = await request(httpServer).get('/authorize').query({
          client_id: 'registered-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
          scope: 'mcp:read',
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain(
          'https://app.forestadmin.com/authentication/mcp-login',
        );
      });

      it('should handle POST method for authorize', async () => {
        // POST /authorize uses form-encoded body
        const response = await request(httpServer).post('/authorize').type('form').send({
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
          `https://app.forestadmin.com/authentication/mcp-login?redirect_uri=${encodeURIComponent(
            'https://example.com/callback',
          )}&code_challenge=test-challenge&client_id=registered-client&state=test-state&scope=${encodeURIComponent(
            'mcp:read',
          )}&resource=${encodeURIComponent('https://example.com/resource')}&environmentId=12345`,
        );
      });
    });
  });
});
