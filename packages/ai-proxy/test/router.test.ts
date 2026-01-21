import type { DispatchBody, Route } from '../src';
import type { InvokeRemoteToolBody } from '../src/router';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { AIUnprocessableError, Router } from '../src';
import McpClient from '../src/mcp-client';

const invokeToolMock = jest.fn();
const toolDefinitionsForFrontend = [{ name: 'tool-name', description: 'tool-description' }];

jest.mock('../src/remote-tools', () => {
  return {
    RemoteTools: jest.fn().mockImplementation(() => ({
      tools: [],
      toolDefinitionsForFrontend,
      invokeTool: invokeToolMock,
    })),
  };
});

const dispatchMock = jest.fn();
jest.mock('../src/provider-dispatcher', () => {
  return {
    ProviderDispatcher: jest.fn().mockImplementation(() => ({
      dispatch: dispatchMock,
    })),
  };
});

jest.mock('../src/mcp-client', () => {
  return jest.fn().mockImplementation(() => ({
    loadTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn(),
  }));
});

const MockedMcpClient = McpClient as jest.MockedClass<typeof McpClient>;

describe('route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when the route is /ai-query', () => {
    it('calls the provider dispatcher', async () => {
      const router = new Router({
        aiConfigurations: [
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
        ],
      });

      await router.route({
        route: 'ai-query',
        body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
      });

      expect(dispatchMock).toHaveBeenCalledWith({
        tools: [],
        tool_choice: 'required',
        messages: [],
      });
    });

    it('selects the AI configuration by name when ai-name query is provided', async () => {
      const router = new Router({
        aiConfigurations: [
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
          {
            name: 'gpt3',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-3.5-turbo',
          },
        ],
      });

      await router.route({
        route: 'ai-query',
        query: { 'ai-name': 'gpt3' },
        body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
      });

      expect(dispatchMock).toHaveBeenCalled();
    });

    it('uses first configuration when ai-name query is not provided', async () => {
      const router = new Router({
        aiConfigurations: [
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
          {
            name: 'gpt3',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-3.5-turbo',
          },
        ],
      });

      await router.route({
        route: 'ai-query',
        body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
      });

      expect(dispatchMock).toHaveBeenCalled();
    });

    it('throws an error when ai-name references non-existent configuration', async () => {
      const router = new Router({
        aiConfigurations: [
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
        ],
      });

      await expect(
        router.route({
          route: 'ai-query',
          query: { 'ai-name': 'non-existent' },
          body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
        }),
      ).rejects.toThrow(
        "AI configuration 'non-existent' not found. Available configurations: gpt4",
      );
    });
  });

  describe('when the route is /invoke-remote-tool', () => {
    it('calls the remote tools', async () => {
      const router = new Router({});

      await router.route({
        route: 'invoke-remote-tool',
        query: { 'tool-name': 'tool-name' },
        body: { inputs: [] },
      });

      expect(invokeToolMock).toHaveBeenCalledWith('tool-name', []);
    });

    it('throws an error when tool-name query parameter is missing', async () => {
      const router = new Router({});

      await expect(
        router.route({
          route: 'invoke-remote-tool',
          query: {},
          body: { inputs: [] },
        }),
      ).rejects.toThrow('Missing required query parameter: tool-name');
    });

    it('throws an error when body.inputs is missing', async () => {
      const router = new Router({});

      await expect(
        router.route({
          route: 'invoke-remote-tool',
          query: { 'tool-name': 'tool-name' },
          body: {} as InvokeRemoteToolBody,
        }),
      ).rejects.toThrow('Missing required body parameter: inputs');
    });
  });

  describe('when the route is /remote-tools', () => {
    it('returns the remote tools definitions', async () => {
      const router = new Router({});

      const result = await router.route({ route: 'remote-tools' });

      expect(result).toEqual(toolDefinitionsForFrontend);
    });
  });

  describe('when the route is unknown', () => {
    it('throws an error', async () => {
      const router = new Router({});

      await expect(router.route({ route: 'unknown' as Route })).rejects.toThrow(
        new AIUnprocessableError('No action to perform: {"route":"unknown"}'),
      );
    });

    it('does not include mcpConfigs in the error message', async () => {
      const router = new Router({});

      await expect(
        router.route({
          route: 'unknown' as Route,
          mcpConfigs: { configs: {} },
        }),
      ).rejects.toThrow(new AIUnprocessableError('No action to perform: {"route":"unknown"}'));
    });
  });

  describe('MCP connection cleanup', () => {
    it('closes the MCP connection after successful route handling', async () => {
      const router = new Router({});

      await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(MockedMcpClient).toHaveBeenCalledTimes(1);
      const mcpClientInstance = MockedMcpClient.mock.results[0].value as jest.Mocked<McpClient>;
      expect(mcpClientInstance.closeConnections).toHaveBeenCalledTimes(1);
    });

    it('closes the MCP connection even when an error occurs', async () => {
      const router = new Router({});

      await expect(
        router.route({
          route: 'unknown' as Route,
          mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
        }),
      ).rejects.toThrow();

      expect(MockedMcpClient).toHaveBeenCalledTimes(1);
      const mcpClientInstance = MockedMcpClient.mock.results[0].value as jest.Mocked<McpClient>;
      expect(mcpClientInstance.closeConnections).toHaveBeenCalledTimes(1);
    });

    it('does not call closeConnections when no mcpConfigs provided', async () => {
      const router = new Router({});

      await router.route({
        route: 'remote-tools',
      });

      expect(MockedMcpClient).not.toHaveBeenCalled();
    });

    it('does not throw when closeConnections fails during successful route', async () => {
      const mockLogger = jest.fn();
      const router = new Router({
        logger: mockLogger,
      });
      const closeError = new Error('Cleanup failed');

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          } as unknown as McpClient),
      );

      // Should not throw even though cleanup fails
      const result = await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(result).toBeDefined();
      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        'Error during MCP connection cleanup',
        closeError,
      );
    });

    it('preserves original error when both route and cleanup fail', async () => {
      const mockLogger = jest.fn();
      const router = new Router({
        logger: mockLogger,
      });
      const closeError = new Error('Cleanup failed');

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          } as unknown as McpClient),
      );

      // Should throw the original route error, not the cleanup error
      await expect(
        router.route({
          route: 'unknown' as Route,
          mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
        }),
      ).rejects.toThrow(AIUnprocessableError);

      // Cleanup error should be logged
      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        'Error during MCP connection cleanup',
        closeError,
      );
    });
  });

  describe('Logger injection', () => {
    it('uses the injected logger instead of console', async () => {
      const customLogger: Logger = jest.fn();
      const router = new Router({
        logger: customLogger,
      });
      const closeError = new Error('Cleanup failed');

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          } as unknown as McpClient),
      );

      await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      // Custom logger should be called
      expect(customLogger).toHaveBeenCalledWith(
        'Error',
        'Error during MCP connection cleanup',
        closeError,
      );
    });

    it('passes logger to McpClient', async () => {
      const customLogger: Logger = jest.fn();
      const router = new Router({
        logger: customLogger,
      });

      await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(MockedMcpClient).toHaveBeenCalledWith(
        { configs: { server1: { command: 'test', args: [] } } },
        customLogger,
      );
    });
  });
});
