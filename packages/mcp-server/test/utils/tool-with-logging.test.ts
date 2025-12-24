import { z } from 'zod';

import registerToolWithLogging from '../../src/utils/tool-with-logging';

describe('registerToolWithLogging', () => {
  let mockMcpServer: { registerTool: jest.Mock };
  let mockLogger: jest.Mock;
  let registeredHandler: (args: unknown, extra: unknown) => Promise<unknown>;

  const toolConfig = {
    title: 'Test Tool',
    description: 'A test tool',
    inputSchema: {
      name: z.string(),
      count: z.number(),
    },
  };

  beforeEach(() => {
    mockMcpServer = {
      registerTool: jest.fn((_, __, handler) => {
        registeredHandler = handler;
      }),
    };
    mockLogger = jest.fn();
  });

  describe('tool registration', () => {
    it('should register the tool with the MCP server', () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'test-tool',
        toolConfig,
        expect.any(Function),
      );
    });

    it('should return the tool name', () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      const result = registerToolWithLogging(
        mockMcpServer as never,
        'my-tool',
        toolConfig,
        handler,
        mockLogger,
      );

      expect(result).toBe('my-tool');
    });
  });

  describe('validation error logging', () => {
    it('should log validation error when arguments are invalid', async () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const invalidArgs = { name: 123, count: 'not a number' };
      await registeredHandler(invalidArgs, {});

      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('[MCP] Tool "test-tool" validation error:'),
      );
      expect(mockLogger).toHaveBeenCalledWith('Error', expect.stringContaining('name:'));
      expect(mockLogger).toHaveBeenCalledWith('Error', expect.stringContaining('count:'));
    });

    it('should log validation error for missing required field', async () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const missingFieldArgs = { name: 'test' };
      await registeredHandler(missingFieldArgs, {});

      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('[MCP] Tool "test-tool" validation error:'),
      );
      expect(mockLogger).toHaveBeenCalledWith('Error', expect.stringContaining('count:'));
    });

    it('should not log when arguments are valid', async () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const validArgs = { name: 'test', count: 42 };
      await registeredHandler(validArgs, {});

      expect(mockLogger).not.toHaveBeenCalled();
    });
  });

  describe('handler execution', () => {
    it('should call the handler with the original arguments', async () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const args = { name: 'test', count: 42 };
      const extra = { sessionId: '123' };
      await registeredHandler(args, extra);

      expect(handler).toHaveBeenCalledWith(args, extra);
    });

    it('should return the handler result', async () => {
      const expectedResult = { content: [{ type: 'text', text: 'success' }] };
      const handler = jest.fn().mockResolvedValue(expectedResult);

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const result = await registeredHandler({ name: 'test', count: 42 }, {});

      expect(result).toBe(expectedResult);
    });

    it('should propagate handler errors without logging', async () => {
      const error = new Error('Handler failed');
      const handler = jest.fn().mockRejectedValue(error);

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      await expect(registeredHandler({ name: 'test', count: 42 }, {})).rejects.toThrow(
        'Handler failed',
      );
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it('should call handler even when validation fails', async () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const invalidArgs = { name: 123, count: 'bad' };
      await registeredHandler(invalidArgs, {});

      expect(handler).toHaveBeenCalledWith(invalidArgs, {});
    });
  });

  describe('optional fields', () => {
    it('should handle optional fields in schema', async () => {
      const optionalConfig = {
        title: 'Optional Tool',
        description: 'Tool with optional fields',
        inputSchema: {
          name: z.string(),
          description: z.string().optional(),
        },
      };

      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      registerToolWithLogging(
        mockMcpServer as never,
        'optional-tool',
        optionalConfig,
        handler,
        mockLogger,
      );

      await registeredHandler({ name: 'test' }, {});

      expect(mockLogger).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith({ name: 'test' }, {});
    });
  });
});
