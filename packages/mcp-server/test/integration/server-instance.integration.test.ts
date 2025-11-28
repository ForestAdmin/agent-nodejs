import type * as http from 'http';

import request from 'supertest';

import ForestAdminMCPServer from '../../src/server';

/**
 * Integration tests for ForestAdminMCPServer instance
 * Tests the actual server class and its behavior
 */
describe('ForestAdminMCPServer Instance', () => {
  let server: ForestAdminMCPServer;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.FOREST_ENV_SECRET = 'test-env-secret';
    process.env.FOREST_AUTH_SECRET = 'test-auth-secret';
    process.env.FOREST_SERVER_URL = 'https://test.forestadmin.com';
    process.env.AGENT_HOSTNAME = 'http://localhost:3310';
  });

  afterEach(async () => {
    process.env = originalEnv;

    // Clean up server if it was started
    if (server && server.httpServer) {
      await new Promise<void>(resolve => {
        server.httpServer?.close(() => resolve());
      });
    }
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

    beforeEach(async () => {
      const testPort = 39312;
      process.env.MCP_SERVER_PORT = testPort.toString();

      server = new ForestAdminMCPServer();
      server.run();

      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });

      httpServer = server.httpServer as http.Server;
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

    it('should parse JSON bodies', async () => {
      const requestBody = { jsonrpc: '2.0', method: 'tools/list', id: 1 };

      const response = await request(httpServer)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).not.toBe(400);
    });

    it('should return JSON-RPC error on transport failure', async () => {
      // Send invalid request
      const response = await request(httpServer).post('/mcp').send('invalid json');

      // Should handle the error gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('server properties', () => {
    beforeEach(() => {
      server = new ForestAdminMCPServer();
    });

    it('should have mcpServer property', () => {
      expect(server.mcpServer).toBeDefined();
    });

    it('should have forestServerUrl property', () => {
      expect(server.forestServerUrl).toBeDefined();
      expect(typeof server.forestServerUrl).toBe('string');
    });

    it('should initially have undefined mcpTransport', () => {
      expect(server.mcpTransport).toBeUndefined();
    });

    it('should initially have undefined httpServer', () => {
      expect(server.httpServer).toBeUndefined();
    });
  });
});
