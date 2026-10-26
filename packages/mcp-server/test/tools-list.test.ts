import type * as http from 'http';
import type * as net from 'net';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readFileSync } from 'fs';
import jsonwebtoken from 'jsonwebtoken';
import * as path from 'path';

import createMockForestServerClient from './helpers/forest-server-client';
import MockServer from './test-utils/mock-server';
import ForestMCPServer from '../src/server';
import { clearSchemaCache } from '../src/utils/schema-fetcher';

const AUTH_SECRET = 'test-auth-secret';
const ALL_TOOL_NAMES = [
  'describeCollection',
  'list',
  'listRelated',
  'create',
  'update',
  'delete',
  'associate',
  'dissociate',
  'getActionForm',
  'executeAction',
  'listWorkflows',
  'triggerWorkflow',
  'getWorkflowRun',
  'requestActionFileUpload',
];

describe('zod dependency', () => {
  it('declares zod as a caret range so consumers dedupe it with the MCP SDK zod', () => {
    const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

    expect(packageJson.dependencies.zod).toMatch(/^\^4\.\d+\.\d+$/);
  });
});

describe('tools/list through the MCP SDK client', () => {
  const savedFetch = global.fetch;
  let httpServer: http.Server;
  let client: Client;

  beforeAll(async () => {
    clearSchemaCache();

    const mockServer = new MockServer();
    mockServer
      .get('/liana/environment', {
        data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
      })
      .get(/\/oauth\/register\//, { error: 'Client not found' }, 404);
    global.fetch = mockServer.fetch;

    const server = new ForestMCPServer({
      envSecret: 'test-env-secret',
      authSecret: AUTH_SECRET,
      forestServerUrl: 'https://test.forestadmin.com',
      forestServerClient: createMockForestServerClient({
        fetchSchema: jest
          .fn()
          .mockResolvedValue([{ name: 'users', fields: [{ field: 'id', type: 'Number' }] }]),
      }),
    });
    const app = await server.buildExpressApp();
    httpServer = await new Promise<http.Server>(resolve => {
      const listening = app.listen(0, () => resolve(listening));
    });

    const { port } = httpServer.address() as net.AddressInfo;
    const token = jsonwebtoken.sign(
      {
        id: 123,
        email: 'user@example.com',
        renderingId: 456,
        serverToken: 'forest-server-token',
        scopes: ['mcp:read', 'mcp:write', 'mcp:action'],
      },
      AUTH_SECRET,
      { expiresIn: '1h' },
    );

    client = new Client({ name: 'tools-list-test', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        fetch: savedFetch,
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
  });

  afterAll(async () => {
    global.fetch = savedFetch;
    await client?.close();
    await new Promise<void>(resolve => {
      if (httpServer) httpServer.close(() => resolve());
      else resolve();
    });
  });

  it('lists every tool with an object input schema the SDK converted', async () => {
    const { tools } = await client.listTools();

    expect(tools.map(tool => tool.name).sort()).toEqual([...ALL_TOOL_NAMES].sort());
    tools.forEach(tool => {
      expect(tool.inputSchema).toEqual(
        expect.objectContaining({ type: 'object', properties: expect.any(Object) }),
      );
    });
  });
});
