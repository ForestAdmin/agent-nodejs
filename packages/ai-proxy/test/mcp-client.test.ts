import type { McpConfiguration } from '../src';

import { tool } from '@langchain/core/tools';

import { McpConnectionError } from '../src';
import McpClient from '../src/mcp-client';
import { injectOauthToken, injectOauthTokens } from '../src/oauth-token-injector';
import McpServerRemoteTool from '../src/types/mcp-server-remote-tool';

const getToolsMock = jest.fn();
const closeMock = jest.fn();
const initializeConnectionsMock = jest.fn();
jest.mock('@langchain/mcp-adapters', () => {
  return {
    MultiServerMCPClient: jest.fn().mockImplementation(() => ({
      getTools: getToolsMock,
      close: closeMock,
      initializeConnections: initializeConnectionsMock,
    })),
  };
});

// eslint-disable-next-line import/first
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

const MockedMultiServerMCPClient = MultiServerMCPClient as jest.MockedClass<
  typeof MultiServerMCPClient
>;

describe('McpClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const aConfig: McpConfiguration = {
    configs: {
      slack: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: {},
      },
    },
  };

  describe('loadTools', () => {
    describe('when there is a tool to load', () => {
      it('should load the tools', async () => {
        const tool1 = tool(() => {}, {
          name: 'tool1',
          description: 'description1',
          schema: undefined,
          responseFormat: 'content',
        });
        const tool2 = tool(() => {}, {
          name: 'tool2',
          description: 'description2',
          schema: undefined,
          responseFormat: 'content',
        });
        const mcpClient = new McpClient(aConfig);
        getToolsMock.mockResolvedValue([tool1, tool2]);

        await mcpClient.loadTools();

        expect(mcpClient.tools).toEqual([
          new McpServerRemoteTool({
            tool: tool1,
            sourceId: 'slack',
          }),
          new McpServerRemoteTool({
            tool: tool2,
            sourceId: 'slack',
          }),
        ]);
      });
    });

    describe('when there is no tool to load', () => {
      it('should not load the tools', async () => {
        const mcpClient = new McpClient(aConfig);
        getToolsMock.mockResolvedValue(undefined);

        await mcpClient.loadTools();

        expect(mcpClient.tools.length).toEqual(0);
      });
    });

    describe('when there is an error while loading the tools', () => {
      it('should not throw an error and try to load every mcp tools', async () => {
        const mcpClient = new McpClient({
          configs: {
            slack: {
              transport: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-slack'],
              env: {},
            },
            slack2: {
              transport: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-slack'],
              env: {},
            },
          },
        });
        getToolsMock
          .mockRejectedValueOnce(new Error('Error loading tools'))
          .mockResolvedValueOnce(['tool1', 'tool2']);

        await mcpClient.loadTools();

        expect(mcpClient.tools.length).toEqual(2);
      });
    });
  });

  describe('closeConnection', () => {
    it('should close the connection', async () => {
      const mcpClient = new McpClient(aConfig);

      await mcpClient.closeConnections();

      expect(closeMock).toHaveBeenCalled();
    });

    it('should attempt to close all connections when multiple servers configured', async () => {
      const mcpClient = new McpClient({
        configs: {
          slack: {
            transport: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-slack'],
            env: {},
          },
          github: {
            transport: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {},
          },
        },
      });
      closeMock.mockResolvedValue(undefined);

      await mcpClient.closeConnections();

      expect(closeMock).toHaveBeenCalledTimes(2);
    });

    it('should attempt to close all connections even if one fails', async () => {
      const loggerMock = jest.fn();
      const mcpClient = new McpClient(
        {
          configs: {
            slack: {
              transport: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-slack'],
              env: {},
            },
            github: {
              transport: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-github'],
              env: {},
            },
          },
        },
        loggerMock,
      );
      closeMock
        .mockRejectedValueOnce(new Error('Slack close failed'))
        .mockResolvedValueOnce(undefined);

      await mcpClient.closeConnections();

      // Should attempt to close both connections
      expect(closeMock).toHaveBeenCalledTimes(2);
      // Should log the error via logger
      expect(loggerMock).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to close MCP connection for'),
        expect.any(Error),
      );
      expect(loggerMock).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to close 1/2 MCP connections'),
      );
    });

    it('should not throw when closeConnections fails', async () => {
      const loggerMock = jest.fn();
      const mcpClient = new McpClient(aConfig, loggerMock);
      closeMock.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await mcpClient.closeConnections();

      expect(loggerMock).toHaveBeenCalled();
    });
  });

  describe('testConnections', () => {
    it('should init the connections & close the connections even if there is no error', async () => {
      const mcpClient = new McpClient(aConfig);

      await mcpClient.testConnections();

      expect(closeMock).toHaveBeenCalled();
      expect(initializeConnectionsMock).toHaveBeenCalled();
    });

    describe('when the connection fails', () => {
      it('should throw a McpConnectionError', async () => {
        const mcpClient = new McpClient(aConfig);
        const errorMessage = 'Connection error';
        initializeConnectionsMock.mockRejectedValue(new Error(errorMessage));

        await expect(mcpClient.testConnections()).rejects.toThrow(
          new McpConnectionError(errorMessage),
        );
        expect(closeMock).toHaveBeenCalled();
      });

      it('should preserve original connection error when cleanup also fails', async () => {
        const loggerMock = jest.fn();
        const mcpClient = new McpClient(aConfig, loggerMock);
        const connectionError = 'Connection failed';
        initializeConnectionsMock.mockRejectedValue(new Error(connectionError));
        closeMock.mockRejectedValue(new Error('Cleanup failed'));

        // Original connection error should be thrown, not the cleanup error
        await expect(mcpClient.testConnections()).rejects.toThrow(
          new McpConnectionError(connectionError),
        );
        // Cleanup failure should be logged via closeConnections internal logging
        expect(loggerMock).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Failed to close MCP connection for'),
          expect.any(Error),
        );
      });
    });
  });

  describe('injectOauthToken', () => {
    it('should inject OAuth token as Authorization header into HTTP type transport', () => {
      const serverConfig = {
        type: 'http' as const,
        url: 'https://example.com/mcp',
      };

      const result = injectOauthToken(serverConfig, 'my-oauth-token');

      expect(result).toEqual({
        type: 'http',
        url: 'https://example.com/mcp',
        headers: {
          Authorization: 'my-oauth-token',
        },
      });
    });

    it('should inject OAuth token as Authorization header into SSE type transport', () => {
      const serverConfig = {
        type: 'sse' as const,
        url: 'https://example.com/mcp',
      };

      const result = injectOauthToken(serverConfig, 'my-oauth-token');

      expect(result).toEqual({
        type: 'sse',
        url: 'https://example.com/mcp',
        headers: {
          Authorization: 'my-oauth-token',
        },
      });
    });

    it('should merge Authorization header with existing headers and strip oauthConfig', () => {
      const serverConfig = {
        type: 'http' as const,
        url: 'https://example.com/mcp',
        headers: {
          'x-custom-header': 'custom-value',
          oauthConfig: { clientId: 'test' } as unknown as string,
        },
      };

      const result = injectOauthToken(serverConfig, 'my-oauth-token');

      expect(result).toEqual({
        type: 'http',
        url: 'https://example.com/mcp',
        headers: {
          'x-custom-header': 'custom-value',
          Authorization: 'my-oauth-token',
        },
      });
    });

    it('should not inject OAuth token into stdio transport even if token provided', () => {
      const serverConfig = {
        transport: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: {},
      };

      const result = injectOauthToken(serverConfig, 'my-oauth-token');

      expect(result).toEqual(serverConfig);
    });

    it('should not modify config when no token is provided', () => {
      const serverConfig = {
        type: 'http' as const,
        url: 'https://example.com/mcp',
      };

      const result = injectOauthToken(serverConfig);

      expect(result).toEqual(serverConfig);
    });

    it('should return same reference when no token is provided', () => {
      const serverConfig = {
        type: 'http' as const,
        url: 'https://example.com/mcp',
      };

      const result = injectOauthToken(serverConfig);

      expect(result).toBe(serverConfig);
    });
  });

  describe('injectOauthTokens', () => {
    it('should inject tokens into all matching server configs', () => {
      const mcpConfigs = {
        configs: {
          server1: { type: 'http' as const, url: 'https://server1.com' },
          server2: { type: 'http' as const, url: 'https://server2.com' },
        },
      };
      const tokens = { server1: 'token1', server2: 'token2' };

      const result = injectOauthTokens(mcpConfigs, tokens);

      expect(result).toEqual({
        configs: {
          server1: {
            type: 'http',
            url: 'https://server1.com',
            headers: { Authorization: 'token1' },
          },
          server2: {
            type: 'http',
            url: 'https://server2.com',
            headers: { Authorization: 'token2' },
          },
        },
      });
    });

    it('should only inject tokens for servers that have matching tokens', () => {
      const mcpConfigs = {
        configs: {
          server1: { type: 'http' as const, url: 'https://server1.com' },
          server2: { type: 'http' as const, url: 'https://server2.com' },
        },
      };
      const tokens = { server1: 'token1' };

      const result = injectOauthTokens(mcpConfigs, tokens);

      expect(result).toEqual({
        configs: {
          server1: {
            type: 'http',
            url: 'https://server1.com',
            headers: { Authorization: 'token1' },
          },
          server2: { type: 'http', url: 'https://server2.com' },
        },
      });
    });

    it('should return undefined when mcpConfigs is undefined', () => {
      const result = injectOauthTokens(undefined, { server1: 'token1' });

      expect(result).toBeUndefined();
    });

    it('should return mcpConfigs unchanged when tokens is undefined', () => {
      const mcpConfigs = {
        configs: {
          server1: { type: 'http' as const, url: 'https://server1.com' },
        },
      };

      const result = injectOauthTokens(mcpConfigs, undefined);

      expect(result).toBe(mcpConfigs);
    });
  });
});
