import ForestIntegrationClient from '../src/forest-integration-client';
import McpClient from '../src/mcp-client';
import { createToolProviders } from '../src/tool-provider-factory';

jest.mock('../src/mcp-client', () => {
  return jest.fn().mockImplementation(() => ({
    loadTools: jest.fn(),
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
      loadTools: jest.fn(),
      checkConnection: jest.fn(),
      dispose: jest.fn(),
    })),
  };
});

describe('createToolProviders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create McpClient for MCP configs', () => {
    const configs = {
      slack: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'] },
    };

    const providers = createToolProviders(configs as any);

    expect(providers).toHaveLength(1);
    expect(McpClient).toHaveBeenCalledWith(
      { configs: { slack: configs.slack } },
      undefined,
    );
  });

  it('should create ForestIntegrationClient for ForestIntegration configs', () => {
    const zendeskConfig = {
      isForestConnector: true as const,
      integrationName: 'Zendesk' as const,
      config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
    };

    const providers = createToolProviders({ zendesk: zendeskConfig });

    expect(providers).toHaveLength(1);
    expect(ForestIntegrationClient).toHaveBeenCalledWith([zendeskConfig], undefined);
  });

  it('should split mixed configs into MCP and integration providers', () => {
    const configs = {
      slack: { command: 'npx', args: [] },
      zendesk: {
        isForestConnector: true as const,
        integrationName: 'Zendesk' as const,
        config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
      },
    };

    const providers = createToolProviders(configs as any);

    expect(providers).toHaveLength(2);
    expect(McpClient).toHaveBeenCalledWith(
      { configs: { slack: configs.slack } },
      undefined,
    );
    expect(ForestIntegrationClient).toHaveBeenCalledWith([configs.zendesk], undefined);
  });

  it('should return empty array when no configs', () => {
    const providers = createToolProviders({});

    expect(providers).toHaveLength(0);
  });

  it('should pass logger to both clients', () => {
    const logger = jest.fn();
    const configs = {
      slack: { command: 'npx', args: [] },
      zendesk: {
        isForestConnector: true as const,
        integrationName: 'Zendesk' as const,
        config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
      },
    };

    createToolProviders(configs as any, logger);

    expect(McpClient).toHaveBeenCalledWith(expect.anything(), logger);
    expect(ForestIntegrationClient).toHaveBeenCalledWith(expect.anything(), logger);
  });
});
