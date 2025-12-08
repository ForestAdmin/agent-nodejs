import type { DispatchBody, Logger, Route } from '../src';

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
        aiClients: {
          openai: {
            clientOptions: { apiKey: 'dev' },
            chatConfiguration: { model: 'gpt-4o' },
          },
        },
      });

      await router.route({
        route: 'ai-query',
        query: { provider: 'openai' },
        body: { tools: [], tool_choice: 'required', messages: [] } as DispatchBody,
      });

      expect(dispatchMock).toHaveBeenCalledWith('openai', {
        tools: [],
        tool_choice: 'required',
        messages: [],
      });
    });
  });

  describe('when the route is /invoke-remote-tool', () => {
    it('calls the remote tools', async () => {
      const router = new Router({
        aiClients: {},
      });

      await router.route({
        route: 'invoke-remote-tool',
        query: { 'tool-name': 'tool-name' },
        body: { inputs: [] },
      });

      expect(invokeToolMock).toHaveBeenCalledWith('tool-name', []);
    });
  });

  describe('when the route is /remote-tools', () => {
    it('returns the remote tools definitions', async () => {
      const router = new Router({
        aiClients: {},
      });

      const result = await router.route({ route: 'remote-tools' });

      expect(result).toEqual(toolDefinitionsForFrontend);
    });
  });

  describe('when the route is unknown', () => {
    it('throws an error', async () => {
      const router = new Router({
        aiClients: {},
      });

      await expect(router.route({ route: 'unknown' as Route })).rejects.toThrow(
        new AIUnprocessableError('No action to perform: {"route":"unknown"}'),
      );
    });

    it('does not include mcpConfigs in the error message', async () => {
      const router = new Router({
        aiClients: {},
      });

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
      const router = new Router({
        aiClients: {},
      });

      await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(MockedMcpClient).toHaveBeenCalledTimes(1);
      const mcpClientInstance = MockedMcpClient.mock.results[0].value as jest.Mocked<McpClient>;
      expect(mcpClientInstance.closeConnections).toHaveBeenCalledTimes(1);
    });

    it('closes the MCP connection even when an error occurs', async () => {
      const router = new Router({
        aiClients: {},
      });

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
      const router = new Router({
        aiClients: {},
      });

      await router.route({
        route: 'remote-tools',
      });

      expect(MockedMcpClient).not.toHaveBeenCalled();
    });

    it('does not throw when closeConnections fails during successful route', async () => {
      const router = new Router({
        aiClients: {},
      });
      const closeError = new Error('Cleanup failed');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          }) as unknown as McpClient,
      );

      // Should not throw even though cleanup fails
      const result = await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(result).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during MCP connection cleanup:',
        closeError,
      );

      consoleErrorSpy.mockRestore();
    });

    it('preserves original error when both route and cleanup fail', async () => {
      const router = new Router({
        aiClients: {},
      });
      const closeError = new Error('Cleanup failed');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          }) as unknown as McpClient,
      );

      // Should throw the original route error, not the cleanup error
      await expect(
        router.route({
          route: 'unknown' as Route,
          mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
        }),
      ).rejects.toThrow(AIUnprocessableError);

      // Cleanup error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during MCP connection cleanup:',
        closeError,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Logger injection', () => {
    it('uses the injected logger instead of console', async () => {
      const customLogger: Logger = {
        error: jest.fn(),
      };
      const router = new Router({
        aiClients: {},
        logger: customLogger,
      });
      const closeError = new Error('Cleanup failed');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          }) as unknown as McpClient,
      );

      await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      // Custom logger should be called
      expect(customLogger.error).toHaveBeenCalledWith(
        'Error during MCP connection cleanup:',
        closeError,
      );
      // Console.error should NOT be called
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('passes logger to McpClient', async () => {
      const customLogger: Logger = {
        error: jest.fn(),
      };
      const router = new Router({
        aiClients: {},
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
