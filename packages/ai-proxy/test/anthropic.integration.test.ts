/**
 * End-to-end integration tests with real Anthropic API and MCP server.
 *
 * These tests require a valid ANTHROPIC_API_KEY environment variable.
 * They are skipped if the key is not present.
 *
 * Run with: yarn workspace @forestadmin/ai-proxy test anthropic.integration
 */
import type { ChatCompletionResponse } from '../src';
import type { Server } from 'http';

// eslint-disable-next-line import/extensions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { Router } from '../src';
import runMcpServer from '../src/examples/simple-mcp-server';

const { ANTHROPIC_API_KEY } = process.env;
const describeWithAnthropic = ANTHROPIC_API_KEY ? describe : describe.skip;

describeWithAnthropic('Anthropic Integration (real API)', () => {
  const router = new Router({
    aiConfigurations: [
      {
        name: 'test-claude',
        provider: 'anthropic',
        model: 'claude-3-5-haiku-latest', // Cheapest model
        apiKey: ANTHROPIC_API_KEY,
      },
    ],
  });

  describe('route: ai-query', () => {
    it('should complete a simple chat request', async () => {
      const response = (await router.route({
        route: 'ai-query',
        body: {
          messages: [
            { role: 'user', content: 'What is 2+2? Reply with just the number.' },
          ],
        },
      })) as ChatCompletionResponse;

      expect(response).toMatchObject({
        id: expect.any(String),
        object: 'chat.completion',
        model: expect.stringContaining('claude'),
        choices: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            message: expect.objectContaining({
              role: 'assistant',
              content: expect.stringContaining('4'),
            }),
            finish_reason: 'stop',
          }),
        ]),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        }),
      });
    }, 10000);

    it('should handle tool calls', async () => {
      const response = (await router.route({
        route: 'ai-query',
        body: {
          messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get the current weather in a given location',
                parameters: {
                  type: 'object',
                  properties: {
                    location: { type: 'string', description: 'The city name' },
                  },
                  required: ['location'],
                },
              },
            },
          ],
          tool_choice: 'auto',
        },
      })) as ChatCompletionResponse;

      expect(response.choices[0].finish_reason).toBe('tool_calls');
      expect(response.choices[0].message.tool_calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'function',
            function: expect.objectContaining({
              name: 'get_weather',
              arguments: expect.stringContaining('Paris'),
            }),
          }),
        ]),
      );
    }, 10000);

    it('should handle tool_choice: required', async () => {
      const response = (await router.route({
        route: 'ai-query',
        body: {
          messages: [{ role: 'user', content: 'Hello!' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'greet',
                description: 'Greet the user',
                parameters: { type: 'object', properties: {} },
              },
            },
          ],
          tool_choice: 'required',
        },
      })) as ChatCompletionResponse;

      expect(response.choices[0].finish_reason).toBe('tool_calls');
      const toolCall = response.choices[0].message.tool_calls?.[0] as {
        function: { name: string };
      };
      expect(toolCall.function.name).toBe('greet');
    }, 10000);

    it('should select AI configuration by name without fallback warning', async () => {
      const mockLogger = jest.fn();
      const multiConfigRouter = new Router({
        aiConfigurations: [
          {
            name: 'primary',
            provider: 'anthropic',
            model: 'claude-3-5-haiku-latest',
            apiKey: ANTHROPIC_API_KEY!,
          },
          {
            name: 'secondary',
            provider: 'anthropic',
            model: 'claude-3-5-haiku-latest',
            apiKey: ANTHROPIC_API_KEY!,
          },
        ],
        logger: mockLogger,
      });

      const response = (await multiConfigRouter.route({
        route: 'ai-query',
        query: { 'ai-name': 'secondary' },
        body: {
          messages: [{ role: 'user', content: 'Say "ok"' }],
        },
      })) as ChatCompletionResponse;

      expect(response.choices[0].message.content).toBeDefined();
      // Verify no fallback warning was logged - this proves 'secondary' was found and selected
      expect(mockLogger).not.toHaveBeenCalledWith('Warn', expect.stringContaining('not found'));
    }, 10000);

    it('should fallback to first config and log warning when requested config not found', async () => {
      const mockLogger = jest.fn();
      const multiConfigRouter = new Router({
        aiConfigurations: [
          {
            name: 'primary',
            provider: 'anthropic',
            model: 'claude-3-5-haiku-latest',
            apiKey: ANTHROPIC_API_KEY!,
          },
        ],
        logger: mockLogger,
      });

      const response = (await multiConfigRouter.route({
        route: 'ai-query',
        query: { 'ai-name': 'non-existent' },
        body: {
          messages: [{ role: 'user', content: 'Say "ok"' }],
        },
      })) as ChatCompletionResponse;

      expect(response.choices[0].message.content).toBeDefined();
      // Verify fallback warning WAS logged
      expect(mockLogger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining("'non-existent' not found"),
      );
    }, 10000);

    it('should handle tool_choice with specific function name', async () => {
      const response = (await router.route({
        route: 'ai-query',
        body: {
          messages: [{ role: 'user', content: 'Hello there!' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'greet',
                description: 'Greet the user',
                parameters: { type: 'object', properties: { name: { type: 'string' } } },
              },
            },
            {
              type: 'function',
              function: {
                name: 'farewell',
                description: 'Say goodbye',
                parameters: { type: 'object', properties: {} },
              },
            },
          ],
          // Force specific function to be called
          tool_choice: { type: 'function', function: { name: 'greet' } },
        },
      })) as ChatCompletionResponse;

      const toolCalls = response.choices[0].message.tool_calls;
      expect(toolCalls).toBeDefined();
      expect(toolCalls).toHaveLength(1);

      const toolCall = toolCalls![0] as { function: { name: string } };
      // Should call 'greet' specifically, not 'farewell'
      expect(toolCall.function.name).toBe('greet');
    }, 10000);

    it('should complete multi-turn conversation with tool results', async () => {
      const addTool = {
        type: 'function' as const,
        function: {
          name: 'calculate',
          description: 'Calculate a math expression',
          parameters: {
            type: 'object',
            properties: { expression: { type: 'string' } },
            required: ['expression'],
          },
        },
      };

      // First turn: get tool call
      const response1 = (await router.route({
        route: 'ai-query',
        body: {
          messages: [{ role: 'user', content: 'What is 5 + 3?' }],
          tools: [addTool],
          tool_choice: 'required',
        },
      })) as ChatCompletionResponse;

      expect(response1.choices[0].finish_reason).toBe('tool_calls');
      const toolCall = response1.choices[0].message.tool_calls?.[0];
      expect(toolCall).toBeDefined();

      // Second turn: provide tool result and get final answer
      const response2 = (await router.route({
        route: 'ai-query',
        body: {
          messages: [
            { role: 'user', content: 'What is 5 + 3?' },
            response1.choices[0].message,
            {
              role: 'tool',
              tool_call_id: toolCall!.id,
              content: '8',
            },
          ],
        },
      })) as ChatCompletionResponse;

      expect(response2.choices[0].finish_reason).toBe('stop');
      expect(response2.choices[0].message.content).toContain('8');
    }, 15000);
  });

  describe('error handling', () => {
    it('should throw authentication error with invalid API key', async () => {
      const invalidRouter = new Router({
        aiConfigurations: [
          {
            name: 'invalid',
            provider: 'anthropic',
            model: 'claude-3-5-haiku-latest',
            apiKey: 'sk-invalid-key',
          },
        ],
      });

      await expect(
        invalidRouter.route({
          route: 'ai-query',
          body: {
            messages: [{ role: 'user', content: 'test' }],
          },
        }),
      ).rejects.toThrow(/Anthropic|authentication|invalid|API key/i);
    }, 10000);

    it('should throw AINotConfiguredError when no AI configuration provided', async () => {
      const routerWithoutAI = new Router({});

      await expect(
        routerWithoutAI.route({
          route: 'ai-query',
          body: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        }),
      ).rejects.toThrow('AI is not configured');
    });
  });

  describe('MCP Server Integration', () => {
    const MCP_PORT = 3125; // Different port from OpenAI tests
    const MCP_TOKEN = 'test-token';
    let mcpServer: Server;

    const mcpConfig = {
      configs: {
        calculator: {
          url: `http://localhost:${MCP_PORT}/mcp`,
          type: 'http' as const,
          headers: {
            Authorization: `Bearer ${MCP_TOKEN}`,
          },
        },
      },
    };

    beforeAll(() => {
      const mcp = new McpServer({ name: 'calculator', version: '1.0.0' });

      mcp.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => {
        return { content: [{ type: 'text', text: String(a + b) }] };
      });

      mcp.tool('multiply', { a: z.number(), b: z.number() }, async ({ a, b }) => {
        return { content: [{ type: 'text', text: String(a * b) }] };
      });

      mcpServer = runMcpServer(mcp, MCP_PORT, MCP_TOKEN);
    });

    afterAll(async () => {
      await new Promise<void>((resolve, reject) => {
        if (!mcpServer) {
          resolve();

          return;
        }

        mcpServer.close(err => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    describe('route: ai-query (with MCP tools)', () => {
      it('should allow Anthropic to call MCP tools', async () => {
        const response = (await router.route({
          route: 'ai-query',
          body: {
            messages: [
              {
                role: 'user',
                content:
                  'You have access to a calculator. Use the add tool to compute 15 + 27. Use the calculator tool.',
              },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'add',
                  description: 'Add two numbers',
                  parameters: {
                    type: 'object',
                    properties: {
                      a: { type: 'number' },
                      b: { type: 'number' },
                    },
                    required: ['a', 'b'],
                  },
                },
              },
            ],
            tool_choice: 'required',
          },
          mcpConfigs: mcpConfig,
        })) as ChatCompletionResponse;

        expect(response.choices[0].finish_reason).toBe('tool_calls');

        const toolCall = response.choices[0].message.tool_calls?.[0] as {
          function: { name: string; arguments: string };
        };
        expect(toolCall.function.name).toBe('add');

        const args = JSON.parse(toolCall.function.arguments);
        expect(args.a).toBe(15);
        expect(args.b).toBe(27);
      }, 10000);

      it('should enrich MCP tool definitions when calling Anthropic', async () => {
        // This test verifies that even with minimal tool definition,
        // the router enriches it with the full MCP schema
        const response = (await router.route({
          route: 'ai-query',
          body: {
            messages: [{ role: 'user', content: 'Multiply 6 by 9' }],
            tools: [
              {
                type: 'function',
                // Minimal definition - router should enrich from MCP
                function: { name: 'multiply', parameters: {} },
              },
            ],
            tool_choice: 'required',
          },
          mcpConfigs: mcpConfig,
        })) as ChatCompletionResponse;

        expect(response.choices[0].finish_reason).toBe('tool_calls');

        const toolCall = response.choices[0].message.tool_calls?.[0] as {
          function: { name: string; arguments: string };
        };
        expect(toolCall.function.name).toBe('multiply');

        // The enriched schema allows Anthropic to properly parse the arguments
        const args = JSON.parse(toolCall.function.arguments);
        expect(typeof args.a).toBe('number');
        expect(typeof args.b).toBe('number');
      }, 10000);
    });
  });
});
