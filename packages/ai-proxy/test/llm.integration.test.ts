/**
 * End-to-end integration tests with real LLM APIs (OpenAI/Anthropic) and MCP server.
 *
 * These tests require valid API keys as environment variables:
 * - OPENAI_API_KEY for OpenAI tests
 * - ANTHROPIC_API_KEY for Anthropic tests
 *
 * Run with: yarn workspace @forestadmin/ai-proxy test llm.integration
 */
import type { AiConfiguration, ChatCompletionResponse } from '../src';
import type { Server } from 'http';

// eslint-disable-next-line import/extensions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { ANTHROPIC_MODELS, Router } from '../src';
import runMcpServer from '../src/examples/simple-mcp-server';

const { OPENAI_API_KEY, ANTHROPIC_API_KEY } = process.env;

type ProviderConfig = {
  name: string;
  config: AiConfiguration;
  mcpPort: number;
  responseIdPattern?: RegExp;
  modelPattern: RegExp;
};

const providers: ProviderConfig[] = [
  OPENAI_API_KEY && {
    name: 'OpenAI',
    config: {
      name: 'test-openai',
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      apiKey: OPENAI_API_KEY,
    },
    mcpPort: 3124,
    responseIdPattern: /^chatcmpl-/,
    modelPattern: /gpt-4o-mini/,
  },
  ANTHROPIC_API_KEY && {
    name: 'Anthropic',
    config: {
      name: 'test-anthropic',
      provider: 'anthropic' as const,
      model: 'claude-3-5-haiku-latest' as const,
      apiKey: ANTHROPIC_API_KEY,
    },
    mcpPort: 3125,
    modelPattern: /claude/,
  },
].filter(Boolean) as ProviderConfig[];

const describeIfProviders = providers.length > 0 ? describe : describe.skip;

describeIfProviders('LLM Integration (real API)', () => {
  describe.each(providers)('$name', ({ config, mcpPort, responseIdPattern, modelPattern }) => {
    const router = new Router({
      aiConfigurations: [config],
    });

    describe('route: ai-query', () => {
      it('should complete a simple chat request', async () => {
        const response = (await router.route({
          route: 'ai-query',
          body: {
            messages: [{ role: 'user', content: 'What is 2+2? Reply with just the number.' }],
          },
        })) as ChatCompletionResponse;

        expect(response).toMatchObject({
          id: responseIdPattern ? expect.stringMatching(responseIdPattern) : expect.any(String),
          object: 'chat.completion',
          model: expect.stringMatching(modelPattern),
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
                    properties: { location: { type: 'string', description: 'The city name' } },
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
            tool_choice: { type: 'function', function: { name: 'greet' } },
          },
        })) as ChatCompletionResponse;

        const toolCalls = response.choices[0].message.tool_calls;
        expect(toolCalls).toBeDefined();
        expect(toolCalls).toHaveLength(1);
        expect((toolCalls![0] as { function: { name: string } }).function.name).toBe('greet');
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
              { role: 'tool', tool_call_id: toolCall!.id, content: '8' },
            ],
          },
        })) as ChatCompletionResponse;

        expect(response2.choices[0].finish_reason).toBe('stop');
        expect(response2.choices[0].message.content).toContain('8');
      }, 15000);

      it('should select AI configuration by name without fallback warning', async () => {
        const mockLogger = jest.fn();
        const multiConfigRouter = new Router({
          aiConfigurations: [
            { ...config, name: 'primary' },
            { ...config, name: 'secondary' },
          ],
          logger: mockLogger,
        });

        const response = (await multiConfigRouter.route({
          route: 'ai-query',
          query: { 'ai-name': 'secondary' },
          body: { messages: [{ role: 'user', content: 'Say "ok"' }] },
        })) as ChatCompletionResponse;

        expect(response.choices[0].message.content).toBeDefined();
        expect(mockLogger).not.toHaveBeenCalledWith('Warn', expect.stringContaining('not found'));
      }, 10000);

      it('should fallback to first config and log warning when requested config not found', async () => {
        const mockLogger = jest.fn();
        const multiConfigRouter = new Router({
          aiConfigurations: [{ ...config, name: 'primary' }],
          logger: mockLogger,
        });

        const response = (await multiConfigRouter.route({
          route: 'ai-query',
          query: { 'ai-name': 'non-existent' },
          body: { messages: [{ role: 'user', content: 'Say "ok"' }] },
        })) as ChatCompletionResponse;

        expect(response.choices[0].message.content).toBeDefined();
        expect(mockLogger).toHaveBeenCalledWith(
          'Warn',
          expect.stringContaining("'non-existent' not found"),
        );
      }, 10000);
    });

    describe('error handling', () => {
      it('should throw authentication error with invalid API key', async () => {
        const invalidRouter = new Router({
          aiConfigurations: [{ ...config, apiKey: 'sk-invalid-key' }],
        });

        await expect(
          invalidRouter.route({
            route: 'ai-query',
            body: { messages: [{ role: 'user', content: 'test' }] },
          }),
        ).rejects.toThrow(/Authentication failed|Incorrect API key|invalid|API key/i);
      }, 10000);

      it('should throw AINotConfiguredError when no AI configuration provided', async () => {
        const routerWithoutAI = new Router({});

        await expect(
          routerWithoutAI.route({
            route: 'ai-query',
            body: { messages: [{ role: 'user', content: 'Hello' }] },
          }),
        ).rejects.toThrow('AI is not configured');
      });
    });

    describe('MCP Server Integration', () => {
      const MCP_TOKEN = 'test-token';
      let mcpServer: Server;

      const mcpConfig = {
        configs: {
          calculator: {
            url: `http://localhost:${mcpPort}/mcp`,
            type: 'http' as const,
            headers: { Authorization: `Bearer ${MCP_TOKEN}` },
          },
        },
      };

      beforeAll(() => {
        const mcp = new McpServer({ name: 'calculator', version: '1.0.0' });
        mcp.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
          content: [{ type: 'text', text: String(a + b) }],
        }));
        mcp.tool('multiply', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
          content: [{ type: 'text', text: String(a * b) }],
        }));
        mcpServer = runMcpServer(mcp, mcpPort, MCP_TOKEN);
      });

      afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
          if (!mcpServer) {
            resolve();

            return;
          }

          mcpServer.close(err => (err ? reject(err) : resolve()));
        });
      });

      it('should call MCP tools', async () => {
        const response = (await router.route({
          route: 'ai-query',
          body: {
            messages: [
              {
                role: 'user',
                content: 'Use the add tool to compute 15 + 27.',
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
                    properties: { a: { type: 'number' }, b: { type: 'number' } },
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

      it('should enrich MCP tool definitions', async () => {
        const response = (await router.route({
          route: 'ai-query',
          body: {
            messages: [{ role: 'user', content: 'Multiply 6 by 9' }],
            tools: [{ type: 'function', function: { name: 'multiply', parameters: {} } }],
            tool_choice: 'required',
          },
          mcpConfigs: mcpConfig,
        })) as ChatCompletionResponse;

        expect(response.choices[0].finish_reason).toBe('tool_calls');
        const toolCall = response.choices[0].message.tool_calls?.[0] as {
          function: { name: string; arguments: string };
        };
        expect(toolCall.function.name).toBe('multiply');
        const args = JSON.parse(toolCall.function.arguments);
        expect(typeof args.a).toBe('number');
        expect(typeof args.b).toBe('number');
      }, 15000);
    });
  });

  // OpenAI-specific tests
  if (OPENAI_API_KEY) {
    describe('OpenAI-specific', () => {
      const router = new Router({
        aiConfigurations: [
          { name: 'test', provider: 'openai', model: 'gpt-4o-mini', apiKey: OPENAI_API_KEY },
        ],
      });

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

        expect(response.choices[0].message.tool_calls).toHaveLength(1);
      }, 10000);
    });
  }

  // Shared tests that don't need provider-specific config
  describe('Shared', () => {
    const router = new Router({
      aiConfigurations: providers.map(p => p.config),
    });

    describe('route: remote-tools', () => {
      it('should return empty array when no remote tools configured', async () => {
        const response = await router.route({ route: 'remote-tools' });
        expect(response).toEqual([]);
      });

      it('should return brave search tool when API key is configured', async () => {
        const routerWithBrave = new Router({
          localToolsApiKeys: { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'fake-key' },
        });

        const response = await routerWithBrave.route({ route: 'remote-tools' });

        expect(response).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'brave-search',
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

    describe('validation errors', () => {
      it('should throw error for missing messages in body', async () => {
        await expect(router.route({ route: 'ai-query', body: {} as any })).rejects.toThrow(
          /messages|required|invalid/i,
        );
      });

      it('should throw error for invalid route', async () => {
        await expect(router.route({ route: 'invalid-route' as any })).rejects.toThrow(
          /invalid.*route/i,
        );
      });
    });
  });
});

// OpenAI models that support tool calling
const OPENAI_MODELS_WITH_TOOLS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] as const;

// Models that are deprecated or not available via the API
// These will be skipped with an informative message
const UNSUPPORTED_MODELS: Record<string, string> = {
  'claude-sonnet-4-5-20250514': 'Model not available - may require specific API tier or region',
  'claude-3-5-sonnet-latest': 'Model not available - may require specific API tier or region',
  'claude-3-5-sonnet-20241022': 'Deprecated - reached end-of-life on October 22, 2025',
  'claude-3-opus-latest': 'Model not available - alias may have been removed',
  'claude-3-opus-20240229': 'Deprecated - reached end-of-life on January 5, 2026',
  'claude-3-sonnet-20240229': 'Deprecated - model no longer available',
  'claude-3-haiku-20240307': 'Deprecated - model no longer available',
};

describeIfProviders('Model Compatibility (tool execution)', () => {
  type ModelConfig = {
    provider: 'openai' | 'anthropic';
    model: string;
    apiKey: string;
  };

  const modelConfigs: ModelConfig[] = [
    ...(ANTHROPIC_API_KEY
      ? ANTHROPIC_MODELS.map(model => ({
          provider: 'anthropic' as const,
          model,
          apiKey: ANTHROPIC_API_KEY,
        }))
      : []),
    ...(OPENAI_API_KEY
      ? OPENAI_MODELS_WITH_TOOLS.map(model => ({
          provider: 'openai' as const,
          model,
          apiKey: OPENAI_API_KEY,
        }))
      : []),
  ];

  it.each(modelConfigs)(
    '$provider/$model: should execute tool calls',
    async ({ provider, model, apiKey }) => {
      // Skip unsupported models with informative message
      if (UNSUPPORTED_MODELS[model]) {
        console.warn(`Skipping ${model}: ${UNSUPPORTED_MODELS[model]}`);

        return;
      }

      const router = new Router({
        aiConfigurations: [{ name: 'test', provider, model, apiKey } as AiConfiguration],
      });

      const response = (await router.route({
        route: 'ai-query',
        body: {
          messages: [{ role: 'user', content: 'Call the ping tool now.' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'ping',
                description: 'A simple ping tool that returns pong',
                parameters: { type: 'object', properties: {} },
              },
            },
          ],
          tool_choice: 'required',
        },
      })) as ChatCompletionResponse;

      expect(response.choices[0].finish_reason).toBe('tool_calls');
      expect(response.choices[0].message.tool_calls?.[0]).toMatchObject({
        type: 'function',
        function: expect.objectContaining({ name: 'ping' }),
      });
    },
    30000,
  );
});
