import { z } from 'zod';

import registerToolWithLogging from '../../src/utils/tool-with-logging';

describe('registerToolWithLogging', () => {
  let mockMcpServer: { registerTool: jest.Mock };
  let mockLogger: jest.Mock;
  let registeredHandler: (args: unknown, extra: unknown) => Promise<unknown>;
  let registeredConfig: { inputSchema: z.ZodTypeAny };

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
      registerTool: jest.fn((_, config, handler) => {
        registeredConfig = config;
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
        expect.objectContaining({ title: 'Test Tool', description: 'A test tool' }),
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

    it('should register with a strict schema that rejects unknown keys', () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const { inputSchema } = registeredConfig;

      // Valid args should pass
      expect(inputSchema.safeParse({ name: 'test', count: 42 }).success).toBe(true);

      // Unknown keys should be rejected
      const resultWithUnknown = inputSchema.safeParse({ name: 'test', count: 42, filter: 'x' });
      expect(resultWithUnknown.success).toBe(false);
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

    it('should catch handler errors and return isError result', async () => {
      const error = new Error('Handler failed');
      const handler = jest.fn().mockRejectedValue(error);

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const result = await registeredHandler({ name: 'test', count: 42 }, {});
      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('Handler failed') }],
        isError: true,
      });
    });

    it('should stringify non-Error throws in isError result', async () => {
      const handler = jest.fn().mockRejectedValue({ code: 'FAIL', detail: 'something broke' });

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const result = await registeredHandler({ name: 'test', count: 42 }, {});
      expect(result).toEqual({
        content: [{ type: 'text', text: '{"code":"FAIL","detail":"something broke"}' }],
        isError: true,
      });
    });

    it('should fallback to String() when JSON.stringify returns undefined', async () => {
      const handler = jest.fn().mockRejectedValue(undefined);

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const result = await registeredHandler({ name: 'test', count: 42 }, {});
      expect(result).toEqual({
        content: [{ type: 'text', text: 'undefined' }],
        isError: true,
      });
    });

    it('should fallback to String() when thrown value has circular references', async () => {
      const circular: Record<string, unknown> = { name: 'loop' };
      circular.self = circular;
      const handler = jest.fn().mockRejectedValue(circular);

      registerToolWithLogging(mockMcpServer as never, 'test-tool', toolConfig, handler, mockLogger);

      const result = await registeredHandler({ name: 'test', count: 42 }, {});
      expect(result).toEqual({
        content: [{ type: 'text', text: '[object Object]' }],
        isError: true,
      });
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

      expect(handler).toHaveBeenCalledWith({ name: 'test' }, {});
    });
  });
});
