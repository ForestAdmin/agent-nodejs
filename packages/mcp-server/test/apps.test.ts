import type { ForestMCPServerOptions } from '../src/server';
import type * as http from 'http';
import type * as net from 'net';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'fs';
import jsonwebtoken from 'jsonwebtoken';

import createMockForestServerClient from './helpers/forest-server-client';
import MockServer from './test-utils/mock-server';
import {
  MCP_APP_MIME_TYPE,
  RECORDS_VIEW_DESCRIPTION,
  RECORDS_VIEW_URI,
  loadMcpApps,
} from '../src/apps/records-view';
import ForestMCPServer from '../src/server';
import { clearSchemaCache } from '../src/utils/schema-fetcher';

const AUTH_SECRET = 'test-auth-secret';
const RECORDS_VIEW_META = {
  ui: { resourceUri: RECORDS_VIEW_URI },
  'ui/resourceUri': RECORDS_VIEW_URI,
};
const APP_ONLY_META = { ui: { visibility: ['app'] } };
const VIEW_TOOLS = ['list', 'listRelated', 'uploadActionFile'];

async function connect(options: Partial<ForestMCPServerOptions>) {
  clearSchemaCache();
  const savedFetch = global.fetch;
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
    ...options,
  });
  const app = await server.buildExpressApp();
  const httpServer = await new Promise<http.Server>(resolve => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const { port } = httpServer.address() as net.AddressInfo;
  const token = jsonwebtoken.sign(
    {
      id: 123,
      email: 'user@example.com',
      renderingId: 456,
      serverToken: 'forest-server-token',
      scopes: ['mcp:read'],
    },
    AUTH_SECRET,
    { expiresIn: '1h' },
  );
  const client = new Client({ name: 'apps-test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      fetch: savedFetch,
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );

  const post = (body: string, authorization?: string) =>
    savedFetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(authorization && { Authorization: authorization }),
      },
      body,
    });

  return {
    client,
    postAuthenticated: (body: string) => post(body, `Bearer ${token}`),
    postAnonymous: (body: string) => post(body),
    close: async () => {
      global.fetch = savedFetch;
      await client.close();
      await new Promise<void>(resolve => {
        httpServer.close(() => resolve());
      });
    },
  };
}

async function toolMetas(client: Client) {
  const { tools } = await client.listTools();

  return Object.fromEntries(tools.map(({ name, _meta: meta }) => [name, meta]));
}

describe('MCP Apps records view', () => {
  describe('when apps are on', () => {
    let session: Awaited<ReturnType<typeof connect>>;

    beforeAll(async () => {
      session = await connect({ apps: true });
    });

    afterAll(async () => {
      await session.close();
    });

    it('links list and listRelated to the records view, with the legacy key too', async () => {
      const metas = await toolMetas(session.client);

      expect(metas.list).toEqual(RECORDS_VIEW_META);
      expect(metas.listRelated).toEqual(RECORDS_VIEW_META);
    });

    it('declares the upload tool for the app only', async () => {
      const metas = await toolMetas(session.client);

      expect(metas.uploadActionFile).toEqual(APP_ONLY_META);
    });

    it('leaves every other tool without a view', async () => {
      const metas = await toolMetas(session.client);
      const others = Object.entries(metas).filter(([name]) => !VIEW_TOOLS.includes(name));

      expect(others.length).toBeGreaterThan(0);
      others.forEach(([, meta]) => expect(meta).toBeUndefined());
    });

    it('advertises the resources capability and lists the view', async () => {
      const { resources } = await session.client.listResources();

      expect(session.client.getServerCapabilities()?.resources).toBeDefined();
      expect(resources).toEqual([
        expect.objectContaining({ uri: RECORDS_VIEW_URI, mimeType: MCP_APP_MIME_TYPE }),
      ]);
    });

    it('serves the bundled HTML as an MCP App resource, without a sandbox domain', async () => {
      const { contents } = await session.client.readResource({ uri: RECORDS_VIEW_URI });

      expect(contents).toEqual([
        { uri: RECORDS_VIEW_URI, mimeType: MCP_APP_MIME_TYPE, text: loadMcpApps().recordsViewHtml },
      ]);
      expect(contents[0]).not.toHaveProperty('_meta');
      expect(contents[0]).toHaveProperty('text', expect.stringMatching(/^<!doctype html>/));
    });
  });

  describe('when apps are off', () => {
    let session: Awaited<ReturnType<typeof connect>>;

    beforeAll(async () => {
      session = await connect({});
    });

    afterAll(async () => {
      await session.close();
    });

    it('gives no tool a view', async () => {
      const metas = await toolMetas(session.client);

      Object.values(metas).forEach(meta => expect(meta).toBeUndefined());
    });

    it('does not register the upload tool', async () => {
      const { tools } = await session.client.listTools();

      expect(tools.map(({ name }) => name)).not.toContain('uploadActionFile');
    });

    it('keeps the list tool descriptions free of the view instruction', async () => {
      const { tools } = await session.client.listTools();
      const listTools = tools.filter(({ name }) => name === 'list' || name === 'listRelated');

      expect(listTools).toHaveLength(2);
      listTools.forEach(({ description }) =>
        expect(description).not.toContain(RECORDS_VIEW_DESCRIPTION),
      );
    });

    it('registers no resource', async () => {
      expect(session.client.getServerCapabilities()?.resources).toBeUndefined();
      await expect(session.client.readResource({ uri: RECORDS_VIEW_URI })).rejects.toThrow();
    });
  });

  it('serves the view when only listRelated is enabled', async () => {
    const session = await connect({ apps: true, enabledTools: ['listRelated'] });

    try {
      const metas = await toolMetas(session.client);
      const { resources } = await session.client.listResources();

      expect(metas.listRelated).toEqual(RECORDS_VIEW_META);
      expect(resources.map(resource => resource.uri)).toEqual([RECORDS_VIEW_URI]);
    } finally {
      await session.close();
    }
  });

  it('registers no view when neither list tool is enabled', async () => {
    const session = await connect({ apps: true, enabledTools: ['create'] });

    try {
      const { tools } = await session.client.listTools();

      expect(session.client.getServerCapabilities()?.resources).toBeUndefined();
      expect(tools.map(({ name }) => name)).not.toContain('uploadActionFile');
    } finally {
      await session.close();
    }
  });
});

describe('uploadActionFile request bodies', () => {
  const ONE_MIB = 1024 * 1024;
  const toolCall = (contentBase64: string) =>
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'uploadActionFile',
        arguments: { filename: 'a.pdf', mimeType: 'application/pdf', contentBase64 },
      },
    });

  it('accepts a file above the default 100 KB body limit once authenticated', async () => {
    const session = await connect({ apps: true });

    try {
      const result = await session.client.callTool({
        name: 'uploadActionFile',
        arguments: {
          filename: 'a.pdf',
          mimeType: 'application/pdf',
          contentBase64: Buffer.alloc(ONE_MIB, 1).toString('base64'),
        },
      });
      const [content] = result.content as Array<{ text: string }>;

      expect(result.isError).toBeFalsy();
      expect(JSON.parse(content.text)).toMatchObject({ size: ONE_MIB });
    } finally {
      await session.close();
    }
  });

  it('rejects a large body without a token before parsing it', async () => {
    const session = await connect({ apps: true });

    try {
      const response = await session.postAnonymous(
        toolCall(Buffer.alloc(ONE_MIB, 1).toString('base64')),
      );

      expect(response.status).toBe(401);
    } finally {
      await session.close();
    }
  });

  it('refuses an authenticated body above the app upload limit', async () => {
    const session = await connect({ apps: true, fileUploads: { appUploadMaxBytes: 1024 } });

    try {
      const response = await session.postAuthenticated(toolCall('A'.repeat(90 * 1024)));

      expect(response.ok).toBe(false);
    } finally {
      await session.close();
    }
  });

  it('keeps the default body limit when apps are off', async () => {
    const session = await connect({});

    try {
      const response = await session.postAuthenticated(
        toolCall(Buffer.alloc(ONE_MIB, 1).toString('base64')),
      );

      expect(response.ok).toBe(false);
    } finally {
      await session.close();
    }
  });
});

describe('loadMcpApps', () => {
  it('reads the bundled records view', () => {
    expect(loadMcpApps().recordsViewHtml).toMatch(/^<!doctype html>/);
  });

  it('fails with a clear error when the view file is missing', () => {
    expect(() => loadMcpApps('/nowhere/records-view.html')).toThrow(
      'MCP Apps are enabled but the records view could not be read from "/nowhere/records-view.html"',
    );
  });
});

describe('ForestMCPServer apps option', () => {
  const serverOptions = { envSecret: 'test-env-secret', authSecret: AUTH_SECRET };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not read the view when apps are off', () => {
    const readFileSync = jest.spyOn(fs, 'readFileSync');

    expect(() => new ForestMCPServer({ ...serverOptions, apps: false })).not.toThrow();

    expect(readFileSync).not.toHaveBeenCalledWith(
      expect.stringMatching(/records-view\.html$/),
      'utf8',
    );
  });

  it('fails at construction when apps are on and the view cannot be read', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(() => new ForestMCPServer({ ...serverOptions, apps: true })).toThrow(
      /MCP Apps are enabled but the records view could not be read .*\(ENOENT\)/,
    );
  });
});
