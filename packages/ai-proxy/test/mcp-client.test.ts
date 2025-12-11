import type { McpConfiguration } from '../src';

import { tool } from '@langchain/core/tools';

import { McpConnectionError } from '../src';
import McpClient from '../src/mcp-client';
import RemoteTool from '../src/remote-tool';

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
          new RemoteTool({
            tool: tool1,
            sourceId: 'slack',
            sourceType: 'mcp-server',
          }),
          new RemoteTool({
            tool: tool2,
            sourceId: 'slack',
            sourceType: 'mcp-server',
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
});
