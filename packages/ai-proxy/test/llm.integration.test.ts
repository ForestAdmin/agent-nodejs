/**
 * End-to-end integration tests with real OpenAI API and MCP server.
 *
 * These tests require a valid OPENAI_API_KEY environment variable.
 * They are skipped if the key is not present.
 *
 * Run with: yarn workspace @forestadmin/ai-proxy test openai.integration
 */
import type { ChatCompletionResponse } from '../src';
import type { Server } from 'http';

// eslint-disable-next-line import/extensions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import OpenAI from 'openai';
import { z } from 'zod';

import { Router } from '../src';
import runMcpServer from '../src/examples/simple-mcp-server';
import isModelSupportingTools from '../src/supported-models';

const { OPENAI_API_KEY } = process.env;
const describeWithOpenAI = OPENAI_API_KEY ? describe : describe.skip;

/**
 * Fetches available models from OpenAI API.
 * Returns all models that pass `isModelSupportingTools`.
 *
 * If a model fails the integration test, update the blacklist in supported-models.ts.
 */
async function fetchChatModelsFromOpenAI(): Promise<string[]> {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  let models;
  try {
    models = await openai.models.list();
  } catch (error) {
    throw new Error(
      `Failed to fetch models from OpenAI API. ` +
        `Ensure OPENAI_API_KEY is valid and network is available. ` +
        `Original error: ${error}`,
    );
  }

  return models.data
    .map(m => m.id)
    .filter(id => isModelSupportingTools(id))
    .sort();
}

describeWithOpenAI('OpenAI Integration (real API)', () => {
  const router = new Router({
    aiConfigurations: [
      {
        name: 'test-gpt',
        provider: 'openai',
        model: 'gpt-4o-mini', // Cheapest model with tool support
        apiKey: OPENAI_API_KEY,
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
    }, 10000);

    it('should select AI configuration by name without fallback warning', async () => {
      const mockLogger = jest.fn();
      const multiConfigRouter = new Router({
        aiConfigurations: [
          { name: 'primary', provider: 'openai', model: 'gpt-4o-mini', apiKey: OPENAI_API_KEY! },
          { name: 'secondary', provider: 'openai', model: 'gpt-4o-mini', apiKey: OPENAI_API_KEY! },
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
          { name: 'primary', provider: 'openai', model: 'gpt-4o-mini', apiKey: OPENAI_API_KEY! },
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

      // When forcing a specific function, OpenAI returns finish_reason: 'stop' but still includes tool_calls
      // The key assertion is that the specified function was called
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
    it('should throw authentication error with invalid API key', async () => {
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

    it('should throw error for missing messages in body', async () => {
      await expect(
        router.route({
          route: 'ai-query',
          body: {} as any,
        }),
      ).rejects.toThrow(/messages|required|invalid/i);
    }, 10000);

    it('should throw error for empty messages array', async () => {
      // OpenAI requires at least one message
      await expect(
        router.route({
          route: 'ai-query',
          body: { messages: [] },
        }),
      ).rejects.toThrow(/messages|empty|at least one/i);
    }, 10000);

    it('should throw error for invalid route', async () => {
      await expect(
        router.route({
          route: 'invalid-route' as any,
        }),
      ).rejects.toThrow(/No action to perform|invalid.*route/i);
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
      }, 10000);
    });

    describe('MCP error handling', () => {
      it('should continue working when one MCP server is unreachable and log the error', async () => {
        const mockLogger = jest.fn();
        const routerWithLogger = new Router({
          aiConfigurations: [
            { name: 'test-gpt', provider: 'openai', model: 'gpt-4o-mini', apiKey: OPENAI_API_KEY! },
          ],
          logger: mockLogger,
        });

        // Configure working server + unreachable server
        const mixedConfig = {
          configs: {
            calculator: mcpConfig.configs.calculator, // working
            broken: {
              url: 'http://localhost:59999/mcp', // unreachable port
              type: 'http' as const,
            },
          },
        };

        // Should still return tools from the working server
        const response = (await routerWithLogger.route({
          route: 'remote-tools',
          mcpConfigs: mixedConfig,
        })) as Array<{ name: string; sourceId: string }>;

        // Working server's tools should be available
        const toolNames = response.map(t => t.name);
        expect(toolNames).toContain('add');
        expect(toolNames).toContain('multiply');

        // Verify the error for 'broken' server was logged
        expect(mockLogger).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('broken'),
          expect.any(Error),
        );
      }, 10000);

      it('should handle MCP authentication failure gracefully and log error', async () => {
        const mockLogger = jest.fn();
        const routerWithLogger = new Router({
          aiConfigurations: [
            { name: 'test-gpt', provider: 'openai', model: 'gpt-4o-mini', apiKey: OPENAI_API_KEY! },
          ],
          logger: mockLogger,
        });

        const badAuthConfig = {
          configs: {
            calculator: {
              url: `http://localhost:${MCP_PORT}/mcp`,
              type: 'http' as const,
              headers: {
                Authorization: 'Bearer wrong-token',
              },
            },
          },
        };

        // Should return empty array when auth fails (server rejects)
        const response = (await routerWithLogger.route({
          route: 'remote-tools',
          mcpConfigs: badAuthConfig,
        })) as Array<{ name: string }>;

        // No tools loaded due to auth failure
        expect(response).toEqual([]);

        // Verify the auth error was logged
        expect(mockLogger).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('calculator'),
          expect.any(Error),
        );
      }, 10000);

      it('should allow ai-query to work even when MCP server fails', async () => {
        const brokenMcpConfig = {
          configs: {
            broken: {
              url: 'http://localhost:59999/mcp',
              type: 'http' as const,
            },
          },
        };

        // ai-query should still work (without MCP tools)
        const response = (await router.route({
          route: 'ai-query',
          body: {
            messages: [{ role: 'user', content: 'Say "hello"' }],
          },
          mcpConfigs: brokenMcpConfig,
        })) as ChatCompletionResponse;

        expect(response.choices[0].message.content).toBeDefined();
      }, 10000);
    });

    describe('route: invoke-remote-tool (with MCP)', () => {
      it('should invoke MCP add tool and return result', async () => {
        // MCP tools expect arguments directly matching their schema
        const response = await router.route({
          route: 'invoke-remote-tool',
          query: { 'tool-name': 'add' },
          body: {
            inputs: { a: 5, b: 3 } as any, // Direct tool arguments
          },
          mcpConfigs: mcpConfig,
        });

        // MCP tool returns the computed result as string
        expect(response).toBe('8');
      }, 10000);

      it('should invoke MCP multiply tool and return result', async () => {
        const response = await router.route({
          route: 'invoke-remote-tool',
          query: { 'tool-name': 'multiply' },
          body: {
            inputs: { a: 6, b: 7 } as any, // Direct tool arguments
          },
          mcpConfigs: mcpConfig,
        });

        expect(response).toBe('42');
      }, 10000);
    });

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
      }, 10000);

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
      }, 10000);
    });
  });

  describe('Model tool support verification', () => {
    let modelsToTest: string[];

    beforeAll(async () => {
      modelsToTest = await fetchChatModelsFromOpenAI();
    });

    it('should have found chat models from OpenAI API', () => {
      expect(modelsToTest.length).toBeGreaterThan(0);
      // eslint-disable-next-line no-console
      console.log(`Testing ${modelsToTest.length} models:`, modelsToTest);
    });

    it('all chat models should support tool calls', async () => {
      const results: { model: string; success: boolean; error?: string }[] = [];

      for (const model of modelsToTest) {
        const modelRouter = new Router({
          aiConfigurations: [{ name: 'test', provider: 'openai', model, apiKey: OPENAI_API_KEY }],
        });

        try {
          const response = (await modelRouter.route({
            route: 'ai-query',
            body: {
              messages: [{ role: 'user', content: 'What is 2+2?' }],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'calculate',
                    description: 'Calculate a math expression',
                    parameters: { type: 'object', properties: { result: { type: 'number' } } },
                  },
                },
              ],
              tool_choice: 'required',
              parallel_tool_calls: false,
            },
          })) as ChatCompletionResponse;

          const success =
            response.choices[0].finish_reason === 'tool_calls' &&
            response.choices[0].message.tool_calls !== undefined;

          results.push({ model, success });
        } catch (error) {
          const errorMessage = String(error);

          // Infrastructure errors should fail the test immediately
          const isInfrastructureError =
            errorMessage.includes('rate limit') ||
            errorMessage.includes('429') ||
            errorMessage.includes('401') ||
            errorMessage.includes('Authentication') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('ETIMEDOUT') ||
            errorMessage.includes('getaddrinfo');

          if (isInfrastructureError) {
            throw new Error(`Infrastructure error testing model ${model}: ${errorMessage}`);
          }

          results.push({ model, success: false, error: errorMessage });
        }
      }

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        const failedModelNames = failures.map(f => f.model).join(', ');
        // eslint-disable-next-line no-console
        console.error(
          `\n❌ ${failures.length} model(s) failed: ${failedModelNames}\n\n` +
            `To fix this, add the failing model(s) to the blacklist in:\n` +
            `  packages/ai-proxy/src/supported-models.ts\n\n` +
            `Add to OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT_PREFIXES (for prefix match)\n` +
            `or OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT_PATTERNS (for contains match)\n`,
          failures,
        );
      }

      expect(failures).toEqual([]);
    }, 300000); // 5 minutes for all models
  });
});
