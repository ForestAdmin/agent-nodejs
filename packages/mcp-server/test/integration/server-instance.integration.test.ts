import type * as http from 'http';

import request from 'supertest';

import ForestAdminMCPServer from '../../src/server';

function shutDownHttpServer(server: http.Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server.close(err => {
      if (err) {
        return reject(err);
      }

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

  beforeAll(() => {
    originalEnv = { ...process.env };
    process.env.FOREST_ENV_SECRET = 'test-env-secret';
    process.env.FOREST_AUTH_SECRET = 'test-auth-secret';
    process.env.FOREST_SERVER_URL = 'https://test.forestadmin.com';
    process.env.AGENT_HOSTNAME = 'http://localhost:3310';
  });

  afterAll(async () => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    modifiedEnv = { ...process.env };
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
  });
});
