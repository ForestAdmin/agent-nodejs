/**
 * End-to-end integration tests with real OpenAI API and MCP server.
 *
 * These tests require a valid OPENAI_API_KEY environment variable.
 * They are skipped if the key is not present.
 *
 * Run with: yarn workspace @forestadmin/ai-proxy test openai.integration
 */
import type { Server } from 'http';

import type { ChatCompletionResponse } from '../src';

// eslint-disable-next-line import/extensions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { Router } from '../src';
import runMcpServer from '../src/examples/simple-mcp-server';

const { OPENAI_API_KEY } = process.env;
const describeWithOpenAI = OPENAI_API_KEY ? describe : describe.skip;

describeWithOpenAI('OpenAI Integration (real API)', () => {
  const router = new Router({
    aiConfigurations: [
      {
        name: 'test-gpt',
        provider: 'openai',
        model: 'gpt-4o-mini', // Cheapest model with tool support
        apiKey: OPENAI_API_KEY!,
      },
    ],
  });

  describe('route: ai-query', () => {
    it('should complete a simple chat request', async () => {
      const response = (await router.route({
        route: 'ai-query',
        body: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Be very concise.' },
            { role: 'user', content: 'What is 2+2? Reply with just the number.' },
          ],
        },
      })) as ChatCompletionResponse;

      expect(response).toMatchObject({
        id: expect.stringMatching(/^chatcmpl-/),
        object: 'chat.completion',
        model: expect.stringContaining('gpt-4o-mini'),
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
    }, 30000);

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
    }, 30000);

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
    }, 30000);

    it('should handle parallel_tool_calls: false', async () => {
      const response = (await router.route({
        route: 'ai-query',
        body: {
          messages: [{ role: 'user', content: 'Get weather in Paris and London' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather for a city',
                parameters: {
                  type: 'object',
                  properties: { city: { type: 'string' } },
                  required: ['city'],
                },
              },
            },
          ],
          tool_choice: 'required',
          parallel_tool_calls: false,
        },
      })) as ChatCompletionResponse;

      // With parallel_tool_calls: false, should only get one tool call
      expect(response.choices[0].message.tool_calls).toHaveLength(1);
    }, 30000);

    it('should select AI configuration by name', async () => {
      const multiConfigRouter = new Router({
        aiConfigurations: [
          { name: 'primary', provider: 'openai', model: 'gpt-4o-mini', apiKey: OPENAI_API_KEY! },
          { name: 'secondary', provider: 'openai', model: 'gpt-4o-mini', apiKey: OPENAI_API_KEY! },
        ],
      });

      const response = (await multiConfigRouter.route({
        route: 'ai-query',
        query: { 'ai-name': 'secondary' },
        body: {
          messages: [{ role: 'user', content: 'Say "ok"' }],
        },
      })) as ChatCompletionResponse;

      expect(response.choices[0].message.content).toBeDefined();
    }, 30000);
  });

  describe('route: remote-tools', () => {
    it('should return empty array when no remote tools configured', async () => {
      const response = await router.route({
        route: 'remote-tools',
      });

      // No API keys configured, so no tools available
      expect(response).toEqual([]);
    });

    it('should return brave search tool when API key is configured', async () => {
      const routerWithBrave = new Router({
        localToolsApiKeys: {
          AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'fake-key-for-definition-test',
        },
      });

      const response = await routerWithBrave.route({
        route: 'remote-tools',
      });

      expect(response).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'brave-search', // sanitized name uses hyphen
            description: expect.any(String),
            sourceId: 'brave_search',
            sourceType: 'server',
          }),
        ]),
      );
    });
  });

  describe('route: invoke-remote-tool', () => {
    it('should throw error when tool not found', async () => {
      await expect(
        router.route({
          route: 'invoke-remote-tool',
          query: { 'tool-name': 'non_existent_tool' },
          body: { inputs: [] },
        }),
      ).rejects.toThrow('Tool non_existent_tool not found');
    });
  });

  describe('error handling', () => {
    // Skipped: langchain retries with invalid key cause long delays
    it.skip('should throw authentication error with invalid API key', async () => {
      const invalidRouter = new Router({
        aiConfigurations: [
          {
            name: 'invalid',
            provider: 'openai',
            model: 'gpt-4o-mini',
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
      ).rejects.toThrow(/Authentication failed|Incorrect API key/);
    }, 30000);

    it('should throw validation error for missing messages', async () => {
      await expect(
        router.route({
          route: 'ai-query',
          body: {} as any,
        }),
      ).rejects.toThrow('Missing required body parameter: messages');
    });

    it('should throw validation error for invalid route', async () => {
      await expect(
        router.route({
          route: 'invalid-route' as any,
        }),
      ).rejects.toThrow(
        "Invalid route. Expected: 'ai-query', 'invoke-remote-tool', 'remote-tools'",
      );
    });
  });

  describe('MCP Server Integration', () => {
    const MCP_PORT = 3124;
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

      mcp.tool(
        'multiply',
        { a: z.number(), b: z.number() },
        async ({ a, b }) => {
          return { content: [{ type: 'text', text: String(a * b) }] };
        },
      );

      mcpServer = runMcpServer(mcp, MCP_PORT, MCP_TOKEN);
    });

    afterAll(() => {
      mcpServer?.close();
    });

    describe('route: remote-tools (with MCP)', () => {
      it('should return MCP tools in the list', async () => {
        const response = (await router.route({
          route: 'remote-tools',
          mcpConfigs: mcpConfig,
        })) as Array<{ name: string; sourceType: string; sourceId: string }>;

        const toolNames = response.map(t => t.name);
        expect(toolNames).toContain('add');
        expect(toolNames).toContain('multiply');

        expect(response).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'add',
              sourceType: 'mcp-server',
              sourceId: 'calculator',
            }),
            expect.objectContaining({
              name: 'multiply',
              sourceType: 'mcp-server',
              sourceId: 'calculator',
            }),
          ]),
        );
      }, 30000);
    });

    // Note: invoke-remote-tool with MCP requires specific input format
    // that depends on how langchain MCP adapter handles tool invocation.
    // This is tested indirectly via ai-query tool binding below.

    describe('route: ai-query (with MCP tools)', () => {
      it('should allow OpenAI to call MCP tools', async () => {
        const response = (await router.route({
          route: 'ai-query',
          body: {
            messages: [
              {
                role: 'system',
                content: 'You have access to a calculator. Use the add tool to compute.',
              },
              { role: 'user', content: 'What is 15 + 27? Use the calculator tool.' },
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
      }, 30000);

      it('should enrich MCP tool definitions when calling OpenAI', async () => {
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

        // The enriched schema allows OpenAI to properly parse the arguments
        const args = JSON.parse(toolCall.function.arguments);
        expect(typeof args.a).toBe('number');
        expect(typeof args.b).toBe('number');
      }, 30000);
    });
  });
});
