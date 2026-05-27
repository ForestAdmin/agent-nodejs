import type { ForestIntegrationConfig } from '../src/forest-integration-client';

import { AiClient } from '../src';
import ForestIntegrationClient from '../src/forest-integration-client';
import McpClient from '../src/mcp-client';

// Real `createToolProviders` is used — only the underlying client constructors are mocked,
// so we can assert that AiClient.loadRemoteTools routes each config kind to the right
// provider. This is the PRD-400 regression guard: against the pre-fix code (which built
// McpClient directly with the unfiltered config), the assertion below would fail because
// the Forest connector entry would appear in McpClient's args.

jest.mock('../src/mcp-client', () => {
  return jest.fn().mockImplementation(() => ({
    loadTools: jest.fn().mockResolvedValue([]),
    checkConnection: jest.fn(),
    dispose: jest.fn(),
  }));
});

jest.mock('../src/forest-integration-client', () => {
  const actual = jest.requireActual('../src/forest-integration-client');

  return {
    __esModule: true,
    ...actual,
    default: jest.fn().mockImplementation(() => ({
      loadTools: jest.fn().mockResolvedValue([]),
      checkConnection: jest.fn(),
      dispose: jest.fn(),
    })),
  };
});

const MockedMcpClient = McpClient as jest.MockedClass<typeof McpClient>;
const MockedForestIntegrationClient = ForestIntegrationClient as jest.MockedClass<
  typeof ForestIntegrationClient
>;

describe('AiClient.loadRemoteTools — routing (PRD-400 regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes a Forest connector config to ForestIntegrationClient and NEVER to McpClient', async () => {
    const zendesk: ForestIntegrationConfig = {
      id: 'db-id-zendesk',
      isForestConnector: true,
      integrationName: 'Zendesk',
      config: { subdomain: 'acme', email: 'ops@acme.com', apiToken: 'tok' },
    };

    const client = new AiClient({});
    await client.loadRemoteTools({ Zendesk: zendesk });

    expect(MockedForestIntegrationClient).toHaveBeenCalledTimes(1);
    expect(MockedForestIntegrationClient).toHaveBeenCalledWith([zendesk], undefined);
    expect(MockedMcpClient).not.toHaveBeenCalled();
  });

  it('splits a mixed config: MCP entries go to McpClient, Forest connectors to ForestIntegrationClient', async () => {
    const mcp = { url: 'https://mcp.example.com/mcp' };
    const zendesk: ForestIntegrationConfig = {
      id: 'db-id-zendesk',
      isForestConnector: true,
      integrationName: 'Zendesk',
      config: { subdomain: 'acme', email: 'ops@acme.com', apiToken: 'tok' },
    };

    const client = new AiClient({});
    await client.loadRemoteTools({ 'my-mcp': mcp, Zendesk: zendesk });

    // McpClient must receive ONLY the MCP entry — never the Forest connector.
    // This is the exact failure mode PRD-400 surfaced.
    expect(MockedMcpClient).toHaveBeenCalledTimes(1);
    expect(MockedMcpClient).toHaveBeenCalledWith({ configs: { 'my-mcp': mcp } }, undefined);

    expect(MockedForestIntegrationClient).toHaveBeenCalledTimes(1);
    expect(MockedForestIntegrationClient).toHaveBeenCalledWith([zendesk], undefined);
  });

  it('routes a pure MCP config only to McpClient, not to ForestIntegrationClient', async () => {
    const mcp = { url: 'https://mcp.example.com/mcp' };

    const client = new AiClient({});
    await client.loadRemoteTools({ 'my-mcp': mcp });

    expect(MockedMcpClient).toHaveBeenCalledTimes(1);
    expect(MockedMcpClient).toHaveBeenCalledWith({ configs: { 'my-mcp': mcp } }, undefined);
    expect(MockedForestIntegrationClient).not.toHaveBeenCalled();
  });
});
