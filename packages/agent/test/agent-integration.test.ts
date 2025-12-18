/* eslint-disable max-classes-per-file */

import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import express from 'express';
import Fastify3 from 'fastify';
import Fastify2 from 'fastify2';
import Fastify4 from 'fastify4';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import { tmpdir } from 'os';
import path from 'path';
import superagent from 'superagent';

import MockForestServer from './__helper__/mock-forest-server';
import {
  SqliteSetupResult,
  getTestCollectionsSchema,
  setupSqliteDatabase,
} from './__helper__/sqlite-setup';
import Agent from '../src/agent';

const AUTH_SECRET = 'test-auth-secret-32-chars-min!!!';
// ENV_SECRET must be a 64-character hex string
const ENV_SECRET = '0'.repeat(64);

interface TestContext {
  agent: Agent;
  baseUrl: string;
  cleanup: () => Promise<void>;
}

type FrameworkSetup = (
  agent: Agent,
  port: number,
) => Promise<{ cleanup: () => Promise<void>; baseUrl: string }>;

/**
 * Helper to create a valid JWT token for testing
 */
function createTestToken(payload: object = {}): string {
  return jsonwebtoken.sign(
    {
      id: 1,
      email: 'test@example.com',
      renderingId: 1,
      ...payload,
    },
    AUTH_SECRET,
    { expiresIn: '1h' },
  );
}

/**
 * Setup standalone server
 */
const setupStandalone: FrameworkSetup = async (agent, port) => {
  agent.mountOnStandaloneServer(port, 'localhost');

  return {
    baseUrl: `http://localhost:${port}`,
    cleanup: async () => {
      await agent.stop();
    },
  };
};

/**
 * Setup Express server
 */
const setupExpress: FrameworkSetup = async (agent, port) => {
  const app = express();
  agent.mountOnExpress(app);

  const server = app.listen(port);

  return {
    baseUrl: `http://localhost:${port}`,
    cleanup: async () => {
      await agent.stop();
      await new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      });
    },
  };
};

/**
 * Setup Koa server
 */
const setupKoa: FrameworkSetup = async (agent, port) => {
  const app = new Koa();
  agent.mountOnKoa(app);

  const server = app.listen(port);

  return {
    baseUrl: `http://localhost:${port}`,
    cleanup: async () => {
      await agent.stop();
      server.close();
    },
  };
};

/**
 * Setup Fastify v2 server
 */
const setupFastifyV2: FrameworkSetup = async (agent, port) => {
  const app = Fastify2();
  agent.mountOnFastify(app);

  await app.listen(port);

  return {
    baseUrl: `http://localhost:${port}`,
    cleanup: async () => {
      await agent.stop();
      await app.close();
    },
  };
};

/**
 * Setup Fastify v3 server
 */
const setupFastifyV3: FrameworkSetup = async (agent, port) => {
  const app = Fastify3();
  agent.mountOnFastify(app);

  await app.ready();
  await app.listen(port);

  return {
    baseUrl: `http://localhost:${port}`,
    cleanup: async () => {
      await agent.stop();
      await app.close();
    },
  };
};

/**
 * Setup Fastify v4 server
 */
const setupFastifyV4: FrameworkSetup = async (agent, port) => {
  const app = Fastify4();
  agent.mountOnFastify(app);

  await app.ready();
  await app.listen({ port });

  return {
    baseUrl: `http://localhost:${port}`,
    cleanup: async () => {
      await agent.stop();
      await app.close();
    },
  };
};

/**
 * Setup NestJS with Express adapter
 */
const setupNestExpress: FrameworkSetup = async (agent, port) => {
  @Module({ imports: [], controllers: [], providers: [] })
  class AppModule {}

  const app = await NestFactory.create(AppModule, { logger: false });
  agent.mountOnNestJs(app);

  await app.listen(port);

  return {
    baseUrl: `http://localhost:${port}`,
    cleanup: async () => {
      await agent.stop();
      await app.close();
    },
  };
};

/**
 * Setup NestJS with Fastify adapter
 */
const setupNestFastify: FrameworkSetup = async (agent, port) => {
  @Module({ imports: [], controllers: [], providers: [] })
  class AppModule {}

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  agent.mountOnNestJs(app);

  await app.listen(port);

  return {
    baseUrl: `http://localhost:${port}`,
    cleanup: async () => {
      await agent.stop();
      await app.close();
    },
  };
};

describe('Agent Integration Tests', () => {
  let mockForestServer: MockForestServer;
  let sqliteSetup: SqliteSetupResult;
  let portCounter = 19000; // Starting port for tests

  const getNextPort = () => {
    portCounter += 1;

    return portCounter;
  };

  beforeAll(async () => {
    // Setup SQLite database
    sqliteSetup = await setupSqliteDatabase();

    // Setup mock Forest Admin server
    mockForestServer = new MockForestServer();
    mockForestServer
      .setupDefaultRoutes({
        envSecret: ENV_SECRET,
        collections: getTestCollectionsSchema(),
      })
      .setupSuperagentMock()
      .setupFetchMock();
  });

  afterAll(async () => {
    mockForestServer.restore();
    await sqliteSetup.cleanup();
  });

  beforeEach(() => {
    mockForestServer.clear();
  });

  /**
   * Create a test agent with SQLite datasource
   */
  const createTestAgent = (options: { withMcp?: boolean } = {}) => {
    const schemaPath = path.join(
      tmpdir(),
      `.forestadmin-schema-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );

    const agent = new Agent({
      authSecret: AUTH_SECRET,
      envSecret: ENV_SECRET,
      forestServerUrl: 'https://api.forestadmin.com',
      forestAppUrl: 'https://app.forestadmin.com',
      isProduction: false,
      schemaPath,
    }).addDataSource(createSqlDataSource(sqliteSetup.uri));

    if (options.withMcp) {
      agent.mountAiMcpServer();
    }

    return agent;
  };

  describe.each([
    ['standalone', setupStandalone],
    ['express', setupExpress],
    ['koa', setupKoa],
    ['fastify-v2', setupFastifyV2],
    ['fastify-v3', setupFastifyV3],
    ['fastify-v4', setupFastifyV4],
    ['nestjs-express', setupNestExpress],
    ['nestjs-fastify', setupNestFastify],
  ] as const)('Framework: %s', (frameworkName, setupFramework) => {
    let testContext: TestContext;

    describe('Classic Forest routes (without MCP)', () => {
      beforeAll(async () => {
        const agent = createTestAgent({ withMcp: false });
        const port = getNextPort();
        const { baseUrl, cleanup } = await setupFramework(agent, port);

        await agent.start();

        testContext = { agent, baseUrl, cleanup };
      }, 30000);

      afterAll(async () => {
        await testContext?.cleanup();
      });

      it('should respond to forest health check', async () => {
        const response = await superagent.get(`${testContext.baseUrl}/forest`);

        expect(response.status).toBe(200);
      });

      it('should return 401 for unauthenticated requests to collection routes', async () => {
        await expect(superagent.get(`${testContext.baseUrl}/forest/users`)).rejects.toThrow();
      });

      it('should accept authenticated requests with valid JWT', async () => {
        const token = createTestToken();

        const response = await superagent
          .get(`${testContext.baseUrl}/forest/users`)
          .query({ timezone: 'Europe/Paris' })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(200);

        // Verify JSON API format response
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);

        // Verify we got the seeded users from SQLite
        expect(response.body.data.length).toBeGreaterThan(0);

        // Check full JSON API response format with all 3 seeded users
        expect(response.body).toEqual({
          jsonapi: { version: '1.0' },
          data: [
            {
              type: 'users',
              id: '1',
              attributes: {
                id: 1,
                email: 'john@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: expect.any(String),
              },
              relationships: {
                posts: {
                  links: {
                    related: {
                      href: '/forest/users/1/relationships/posts',
                    },
                  },
                },
              },
            },
            {
              type: 'users',
              id: '2',
              attributes: {
                id: 2,
                email: 'jane@example.com',
                firstName: 'Jane',
                lastName: 'Smith',
                createdAt: expect.any(String),
              },
              relationships: {
                posts: {
                  links: {
                    related: {
                      href: '/forest/users/2/relationships/posts',
                    },
                  },
                },
              },
            },
            {
              type: 'users',
              id: '3',
              attributes: {
                id: 3,
                email: 'bob@example.com',
                firstName: 'Bob',
                lastName: 'Wilson',
                createdAt: expect.any(String),
              },
              relationships: {
                posts: {
                  links: {
                    related: {
                      href: '/forest/users/3/relationships/posts',
                    },
                  },
                },
              },
            },
          ],
        });
      });
    });

    describe('With MCP enabled', () => {
      beforeAll(async () => {
        const agent = createTestAgent({ withMcp: true });
        const port = getNextPort();
        const { baseUrl, cleanup } = await setupFramework(agent, port);

        // Set the agent URL for MCP server callbacks before starting
        mockForestServer.agentUrl = baseUrl;

        await agent.start();

        testContext = { agent, baseUrl, cleanup };
      }, 30000);

      afterAll(async () => {
        await testContext?.cleanup();
        mockForestServer.agentUrl = null;
      });

      it('should still respond to classic forest routes', async () => {
        const response = await superagent.get(`${testContext.baseUrl}/forest`);

        expect(response.status).toBe(200);
      });

      it('should expose /.well-known/oauth-authorization-server', async () => {
        const response = await superagent.get(
          `${testContext.baseUrl}/.well-known/oauth-authorization-server`,
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token_endpoint');
        expect(response.body).toHaveProperty('authorization_endpoint');
        expect(response.body).toHaveProperty('scopes_supported');
        expect(response.body.scopes_supported).toContain('mcp:read');
      });

      it('should handle /oauth/authorize redirect', async () => {
        // The authorize endpoint should redirect to Forest Admin frontend
        const params = new URLSearchParams({
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'code',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
          state: 'test-state',
          scope: 'mcp:read',
        });

        // superagent follows redirects by default, so we expect it to fail
        // when trying to reach the Forest Admin frontend (which doesn't exist in tests)
        const error: { status?: number; response?: { headers?: { location?: string } } } =
          await superagent
            .get(`${testContext.baseUrl}/oauth/authorize?${params.toString()}`)
            .redirects(0)
            .catch(err => err);

        // Should get a redirect (302)
        expect(error.status).toBe(302);
        expect(error.response?.headers?.location).toEqual(
          `https://app.forestadmin.com/oauth/authorize?redirect_uri=${encodeURIComponent(
            'http://localhost:3000/callback',
          )}&code_challenge=test-challenge&code_challenge_method=S256&response_type=code&client_id=test-client&state=test-state&scope=${encodeURIComponent(
            'mcp:read',
          )}&environmentId=123`,
        );
      });

      it('should respond to /mcp endpoint (requires auth)', async () => {
        // Without auth, should get 401
        const error: { status?: number } = await superagent
          .post(`${testContext.baseUrl}/mcp`)
          .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
          .catch(err => err);

        expect(error.status).toBe(401);
      });

      it('should return tools list with valid token', async () => {
        const token = createTestToken({
          scopes: ['mcp:read'],
          renderingId: 1,
        });

        const response = await superagent
          .post(`${testContext.baseUrl}/mcp`)
          .set('Authorization', `Bearer ${token}`)
          .set('Content-Type', 'application/json')
          .set('Accept', 'text/event-stream, application/json')
          .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

        expect(response.status).toBe(200);

        // Parse SSE response - the response text contains event data
        const responseText = response.text;
        const dataLine = responseText.split('\n').find(line => line.startsWith('data:'));

        if (!dataLine) {
          throw new Error('No data line found in SSE response');
        }

        const jsonResponse = JSON.parse(dataLine.replace('data:', '').trim());

        // Verify JSON-RPC response format
        expect(jsonResponse).toHaveProperty('jsonrpc', '2.0');
        expect(jsonResponse).toHaveProperty('id', 1);
        expect(jsonResponse).toHaveProperty('result');
        expect(jsonResponse.result).toHaveProperty('tools');
        expect(Array.isArray(jsonResponse.result.tools)).toBe(true);

        // Verify the list tool is available
        const toolNames = jsonResponse.result.tools.map((t: { name: string }) => t.name);
        expect(toolNames).toContain('list');

        // Verify list tool structure
        const listTool = jsonResponse.result.tools.find((t: { name: string }) => t.name === 'list');
        expect(listTool).toHaveProperty('name', 'list');
        expect(listTool).toHaveProperty('description');
        expect(listTool).toHaveProperty('inputSchema');
        expect(listTool.inputSchema).toHaveProperty('type', 'object');
        expect(listTool.inputSchema).toHaveProperty('properties');

        // Verify collectionName parameter exists
        const collectionNameProp = listTool.inputSchema.properties.collectionName;
        expect(collectionNameProp).toHaveProperty('type', 'string');
      });

      it('should retrieve users via MCP tools/call', async () => {
        const token = createTestToken({
          scopes: ['mcp:read'],
          renderingId: 1,
        });

        const response = await superagent
          .post(`${testContext.baseUrl}/mcp`)
          .set('Authorization', `Bearer ${token}`)
          .set('Content-Type', 'application/json')
          .set('Accept', 'text/event-stream, application/json')
          .send({
            jsonrpc: '2.0',
            method: 'tools/call',
            id: 2,
            params: {
              name: 'list',
              arguments: {
                collectionName: 'users',
              },
            },
          });

        expect(response.status).toBe(200);

        // Parse SSE response
        const responseText = response.text;
        const dataLine = responseText.split('\n').find(line => line.startsWith('data:'));

        if (!dataLine) {
          throw new Error('No data line found in SSE response');
        }

        const jsonResponse = JSON.parse(dataLine.replace('data:', '').trim());

        // Verify JSON-RPC response format
        expect(jsonResponse).toHaveProperty('jsonrpc', '2.0');
        expect(jsonResponse).toHaveProperty('id', 2);
        expect(jsonResponse).toHaveProperty('result');
        expect(jsonResponse.result).toHaveProperty('content');
        expect(Array.isArray(jsonResponse.result.content)).toBe(true);

        // The content contains a text result with JSON stringified users
        const textContent = jsonResponse.result.content.find(
          (c: { type: string }) => c.type === 'text',
        );
        expect(textContent).toBeDefined();

        const result = JSON.parse(textContent.text);

        // Response format is { records: [...] }
        expect(result).toHaveProperty('records');
        const users = result.records;

        // Verify we got the 3 seeded users from SQLite
        expect(users).toHaveLength(3);

        // IDs are strings because they come through JSON API deserialization
        expect(users[0]).toMatchObject({
          id: '1',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
        });

        expect(users[1]).toMatchObject({
          id: '2',
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
        });

        expect(users[2]).toMatchObject({
          id: '3',
          email: 'bob@example.com',
          firstName: 'Bob',
          lastName: 'Wilson',
        });
      });
    });

    describe('Routes coexistence', () => {
      beforeAll(async () => {
        const agent = createTestAgent({ withMcp: true });
        const port = getNextPort();
        const { baseUrl, cleanup } = await setupFramework(agent, port);

        await agent.start();

        testContext = { agent, baseUrl, cleanup };
      }, 30000);

      afterAll(async () => {
        await testContext?.cleanup();
      });

      it('classic forest routes work when MCP is enabled', async () => {
        const response = await superagent.get(`${testContext.baseUrl}/forest`);
        expect(response.status).toBe(200);
      });

      it('MCP OAuth metadata works alongside classic routes', async () => {
        const [forestResponse, mcpResponse] = await Promise.all([
          superagent.get(`${testContext.baseUrl}/forest`),
          superagent.get(`${testContext.baseUrl}/.well-known/oauth-authorization-server`),
        ]);

        expect(forestResponse.status).toBe(200);
        expect(mcpResponse.status).toBe(200);
      });

      it('non-forest routes pass through (return 404 from framework)', async () => {
        const error: { status?: number } = await superagent
          .get(`${testContext.baseUrl}/non-existent-route`)
          .catch(err => err);

        expect(error.status).toBe(404);
      });
    });
  });
});
