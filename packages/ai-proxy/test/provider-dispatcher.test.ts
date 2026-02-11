import type { DispatchBody } from '../src';

import { AIMessage } from '@langchain/core/messages';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';

import {
  AIBadRequestError,
  AINotConfiguredError,
  AnthropicUnprocessableError,
  ProviderDispatcher,
  RemoteTools,
} from '../src';

// Mock raw OpenAI response (returned via __includeRawResponse: true)
const mockOpenAIResponse = {
  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1234567890,
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'response',
        tool_calls: [],
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  },
};

const invokeMock = jest.fn().mockResolvedValue({
  content: 'response',
  tool_calls: [],
  response_metadata: { finish_reason: 'stop' },
  usage_metadata: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
  additional_kwargs: { __raw_response: mockOpenAIResponse },
});

const bindToolsMock = jest.fn().mockReturnValue({ invoke: invokeMock });

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: invokeMock,
    bindTools: bindToolsMock,
  })),
}));

const anthropicInvokeMock = jest.fn();
const anthropicBindToolsMock = jest.fn().mockReturnValue({ invoke: anthropicInvokeMock });

jest.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: jest.fn().mockImplementation(() => {
      return {
        invoke: anthropicInvokeMock,
        bindTools: anthropicBindToolsMock,
      };
    }),
  };
});

describe('ProviderDispatcher', () => {
  const apiKeys = { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'api-key' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatch', () => {
    describe('when AI is not configured', () => {
      it('should throw AINotConfiguredError', async () => {
        const dispatcher = new ProviderDispatcher(null, new RemoteTools(apiKeys));
        await expect(dispatcher.dispatch({} as DispatchBody)).rejects.toThrow(AINotConfiguredError);
        await expect(dispatcher.dispatch({} as DispatchBody)).rejects.toThrow(
          'AI is not configured',
        );
      });
    });
  });

  describe('openai', () => {
    describe('when openai is configured', () => {
      it('should return the response in OpenAI-compatible format', async () => {
        const dispatcher = new ProviderDispatcher(
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
          new RemoteTools(apiKeys),
        );
        const response = await dispatcher.dispatch({
          tools: [],
          messages: [],
        } as unknown as DispatchBody);

        // Response is the raw OpenAI response (via __includeRawResponse)
        expect(response).toEqual(mockOpenAIResponse);
      });

      describe('when the user tries to override the configuration', () => {
        it('should only pass allowed parameters', async () => {
          const dispatcher = new ProviderDispatcher(
            {
              name: 'base',
              provider: 'openai',
              apiKey: 'dev',
              model: 'BASE MODEL',
            },
            new RemoteTools(apiKeys),
          );
          const messages = [{ role: 'user', content: 'Hello' }];
          await dispatcher.dispatch({
            model: 'OTHER MODEL',
            propertyInjection: 'hack',
            tools: [],
            messages,
            tool_choice: 'auto',
          } as unknown as DispatchBody);

          // When no tools, invoke is called directly with messages
          expect(invokeMock).toHaveBeenCalledWith(messages);
        });
      });

      describe('when the openai client throws an error', () => {
        it('should throw an OpenAIUnprocessableError', async () => {
          const dispatcher = new ProviderDispatcher(
            {
              name: 'gpt4',
              provider: 'openai',
              apiKey: 'dev',
              model: 'gpt-4o',
            },
            new RemoteTools(apiKeys),
          );
          invokeMock.mockRejectedValueOnce(new Error('OpenAI error'));

          await expect(
            dispatcher.dispatch({ tools: [], messages: [] } as unknown as DispatchBody),
          ).rejects.toThrow('Error while calling OpenAI: OpenAI error');
        });

        it('should throw rate limit error when status is 429', async () => {
          const dispatcher = new ProviderDispatcher(
            { name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
            new RemoteTools(apiKeys),
          );
          const rateLimitError = new Error('Too many requests') as Error & { status?: number };
          rateLimitError.status = 429;
          invokeMock.mockRejectedValueOnce(rateLimitError);

          await expect(
            dispatcher.dispatch({ tools: [], messages: [] } as unknown as DispatchBody),
          ).rejects.toThrow('Rate limit exceeded: Too many requests');
        });

        it('should throw authentication error when status is 401', async () => {
          const dispatcher = new ProviderDispatcher(
            { name: 'gpt4', provider: 'openai', apiKey: 'invalid', model: 'gpt-4o' },
            new RemoteTools(apiKeys),
          );
          const authError = new Error('Invalid API key') as Error & { status?: number };
          authError.status = 401;
          invokeMock.mockRejectedValueOnce(authError);

          await expect(
            dispatcher.dispatch({ tools: [], messages: [] } as unknown as DispatchBody),
          ).rejects.toThrow('Authentication failed: Invalid API key');
        });
      });

      describe('when rawResponse is missing', () => {
        it('should throw an error indicating API change', async () => {
          const dispatcher = new ProviderDispatcher(
            { name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
            new RemoteTools(apiKeys),
          );
          invokeMock.mockResolvedValueOnce({
            content: 'response',
            additional_kwargs: { __raw_response: null },
          });

          await expect(
            dispatcher.dispatch({ tools: [], messages: [] } as unknown as DispatchBody),
          ).rejects.toThrow(
            'OpenAI response missing raw response data. This may indicate an API change.',
          );
        });
      });
    });

    describe('when there is a remote tool', () => {
      it('should enhance the remote tools definition', async () => {
        const remoteTools = new RemoteTools(apiKeys);
        remoteTools.invokeTool = jest.fn().mockResolvedValue('response');

        const dispatcher = new ProviderDispatcher(
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
          remoteTools,
        );
        const messages = [{ role: 'user', content: 'test' }];
        await dispatcher.dispatch({
          tools: [
            {
              type: 'function',
              // parameters is an empty object because it simulates the front end sending an empty object
              // because it doesn't know the parameters of the tool
              function: { name: remoteTools.tools[0].base.name, parameters: {} },
            },
          ],
          messages,
        } as unknown as DispatchBody);

        // When tools are provided, bindTools is called first
        expect(bindToolsMock).toHaveBeenCalledWith(
          [
            {
              type: 'function',
              function: convertToOpenAIFunction(remoteTools.tools[0].base),
            },
          ],
          { tool_choice: undefined },
        );
        expect(invokeMock).toHaveBeenCalledWith(messages);
      });
    });

    describe('when parallel_tool_calls is provided', () => {
      it('should pass parallel_tool_calls to bindTools', async () => {
        const dispatcher = new ProviderDispatcher(
          { name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          messages: [{ role: 'user', content: 'test' }],
          tools: [{ type: 'function', function: { name: 'test', parameters: {} } }],
          tool_choice: 'auto',
          parallel_tool_calls: false,
        } as unknown as DispatchBody);

        expect(bindToolsMock).toHaveBeenCalledWith(
          [{ type: 'function', function: { name: 'test', parameters: {} } }],
          { tool_choice: 'auto', parallel_tool_calls: false },
        );
      });

      it('should pass parallel_tool_calls: true when explicitly set', async () => {
        const dispatcher = new ProviderDispatcher(
          { name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          messages: [{ role: 'user', content: 'test' }],
          tools: [{ type: 'function', function: { name: 'test', parameters: {} } }],
          parallel_tool_calls: true,
        } as unknown as DispatchBody);

        expect(bindToolsMock).toHaveBeenCalledWith(expect.any(Array), {
          tool_choice: undefined,
          parallel_tool_calls: true,
        });
      });
    });

    describe('when there is not remote tool', () => {
      it('should not enhance the remote tools definition', async () => {
        const remoteTools = new RemoteTools(apiKeys);
        remoteTools.invokeTool = jest.fn().mockResolvedValue('response');

        const dispatcher = new ProviderDispatcher(
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
          remoteTools,
        );
        const messages = [{ role: 'user', content: 'test' }];
        await dispatcher.dispatch({
          tools: [
            {
              type: 'function',
              function: { name: 'notRemoteTool', parameters: {} },
            },
          ],
          messages,
        } as unknown as DispatchBody);

        // When tools are provided, bindTools is called
        expect(bindToolsMock).toHaveBeenCalledWith(
          [
            {
              type: 'function',
              function: { name: 'notRemoteTool', parameters: {} },
            },
          ],
          { tool_choice: undefined },
        );
        expect(invokeMock).toHaveBeenCalledWith(messages);
      });
    });
  });

  describe('anthropic', () => {
    describe('when anthropic is configured', () => {
      it('should return the response from anthropic in OpenAI format', async () => {
        const mockResponse = new AIMessage({
          content: 'Hello from Claude',
          id: 'msg_123',
        });
        Object.assign(mockResponse, {
          usage_metadata: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        const response = await dispatcher.dispatch({
          tools: [],
          messages: [{ role: 'user', content: 'Hello' }],
        } as unknown as DispatchBody);

        expect(response).toEqual(
          expect.objectContaining({
            object: 'chat.completion',
            model: 'claude-3-5-sonnet-latest',
            choices: [
              expect.objectContaining({
                index: 0,
                message: expect.objectContaining({
                  role: 'assistant',
                  content: 'Hello from Claude',
                }),
                finish_reason: 'stop',
              }),
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }),
        );
      });

      it('should convert OpenAI messages to LangChain format', async () => {
        const mockResponse = new AIMessage({ content: 'Response' });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [],
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' },
          ],
        } as unknown as DispatchBody);

        expect(anthropicInvokeMock).toHaveBeenCalledWith([
          expect.objectContaining({ content: 'You are helpful' }),
          expect.objectContaining({ content: 'Hello' }),
          expect.objectContaining({ content: 'Hi there' }),
        ]);
      });

      it('should convert assistant messages with tool_calls correctly', async () => {
        const mockResponse = new AIMessage({ content: 'Done' });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [],
          messages: [
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_123',
                  function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
                },
              ],
            },
            { role: 'tool', content: 'Sunny', tool_call_id: 'call_123' },
          ],
        } as unknown as DispatchBody);

        expect(anthropicInvokeMock).toHaveBeenCalledWith([
          expect.objectContaining({
            content: '',
            tool_calls: [{ id: 'call_123', name: 'get_weather', args: { city: 'Paris' } }],
          }),
          expect.objectContaining({ content: 'Sunny', tool_call_id: 'call_123' }),
        ]);
      });

      it('should return tool_calls in OpenAI format when Claude calls tools', async () => {
        const mockResponse = new AIMessage({
          content: '',
          tool_calls: [{ id: 'call_456', name: 'search', args: { query: 'test' } }],
        });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        const response = (await dispatcher.dispatch({
          tools: [],
          messages: [{ role: 'user', content: 'Search for test' }],
        } as unknown as DispatchBody)) as {
          choices: Array<{ message: { tool_calls: unknown[] }; finish_reason: string }>;
        };

        expect(response.choices[0].message.tool_calls).toEqual([
          {
            id: 'call_456',
            type: 'function',
            function: { name: 'search', arguments: '{"query":"test"}' },
          },
        ]);
        expect(response.choices[0].finish_reason).toBe('tool_calls');
      });
    });

    describe('when tools are provided', () => {
      it('should bind tools to the client', async () => {
        const mockResponse = new AIMessage({ content: 'Response' });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather for a city',
                parameters: { type: 'object', properties: { city: { type: 'string' } } },
              },
            },
          ],
          messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
          tool_choice: 'auto',
        } as unknown as DispatchBody);

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(
          [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather for a city',
                parameters: { type: 'object', properties: { city: { type: 'string' } } },
              },
            },
          ],
          { tool_choice: 'auto' },
        );
      });

      it('should convert tool_choice "required" to "any"', async () => {
        const mockResponse = new AIMessage({ content: 'Response' });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [{ type: 'function', function: { name: 'tool1' } }],
          messages: [],
          tool_choice: 'required',
        } as unknown as DispatchBody);

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: 'any',
        });
      });

      it('should convert specific function tool_choice to Anthropic format', async () => {
        const mockResponse = new AIMessage({ content: 'Response' });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [{ type: 'function', function: { name: 'specific_tool' } }],
          messages: [],
          tool_choice: { type: 'function', function: { name: 'specific_tool' } },
        } as unknown as DispatchBody);

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: { type: 'tool', name: 'specific_tool' },
        });
      });
    });

    describe('when the anthropic client throws an error', () => {
      it('should throw an AnthropicUnprocessableError', async () => {
        anthropicInvokeMock.mockRejectedValueOnce(new Error('Anthropic API error'));

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await expect(
          dispatcher.dispatch({
            tools: [],
            messages: [{ role: 'user', content: 'Hello' }],
          } as unknown as DispatchBody),
        ).rejects.toThrow(AnthropicUnprocessableError);
      });

      it('should include the error message from Anthropic', async () => {
        anthropicInvokeMock.mockRejectedValueOnce(new Error('Anthropic API error'));

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await expect(
          dispatcher.dispatch({
            tools: [],
            messages: [{ role: 'user', content: 'Hello' }],
          } as unknown as DispatchBody),
        ).rejects.toThrow('Error while calling Anthropic: Anthropic API error');
      });

      it('should throw rate limit error when status is 429', async () => {
        const rateLimitError = new Error('Too many requests') as Error & { status?: number };
        rateLimitError.status = 429;
        anthropicInvokeMock.mockRejectedValueOnce(rateLimitError);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await expect(
          dispatcher.dispatch({
            tools: [],
            messages: [{ role: 'user', content: 'Hello' }],
          } as unknown as DispatchBody),
        ).rejects.toThrow('Rate limit exceeded: Too many requests');
      });

      it('should throw authentication error when status is 401', async () => {
        const authError = new Error('Invalid API key') as Error & { status?: number };
        authError.status = 401;
        anthropicInvokeMock.mockRejectedValueOnce(authError);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'invalid',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await expect(
          dispatcher.dispatch({
            tools: [],
            messages: [{ role: 'user', content: 'Hello' }],
          } as unknown as DispatchBody),
        ).rejects.toThrow('Authentication failed: Invalid API key');
      });
    });

    describe('when there is a remote tool', () => {
      it('should enhance the remote tools definition', async () => {
        const mockResponse = new AIMessage({ content: 'Response' });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const remoteTools = new RemoteTools(apiKeys);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          remoteTools,
        );

        await dispatcher.dispatch({
          tools: [
            {
              type: 'function',
              function: { name: remoteTools.tools[0].base.name, parameters: {} },
            },
          ],
          messages: [],
        } as unknown as DispatchBody);

        const expectedEnhancedFunction = convertToOpenAIFunction(remoteTools.tools[0].base);
        expect(anthropicBindToolsMock).toHaveBeenCalledWith(
          [
            {
              type: 'function',
              function: {
                name: expectedEnhancedFunction.name,
                description: expectedEnhancedFunction.description,
                parameters: expectedEnhancedFunction.parameters,
              },
            },
          ],
          expect.anything(),
        );
      });
    });

    describe('message conversion edge cases', () => {
      it('should throw AIBadRequestError for tool message without tool_call_id', async () => {
        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await expect(
          dispatcher.dispatch({
            tools: [],
            messages: [{ role: 'tool', content: 'result' }],
          } as unknown as DispatchBody),
        ).rejects.toThrow(
          new AIBadRequestError('Tool message is missing required "tool_call_id" field.'),
        );
      });

      it('should throw AIBadRequestError for unsupported message role', async () => {
        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await expect(
          dispatcher.dispatch({
            tools: [],
            messages: [{ role: 'unknown', content: 'test' }],
          } as unknown as DispatchBody),
        ).rejects.toThrow(
          new AIBadRequestError(
            "Unsupported message role 'unknown'. Expected: system, user, assistant, or tool.",
          ),
        );
      });

      it('should throw AIBadRequestError for invalid JSON in tool_calls arguments', async () => {
        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await expect(
          dispatcher.dispatch({
            tools: [],
            messages: [
              {
                role: 'assistant',
                content: '',
                tool_calls: [
                  { id: 'call_1', function: { name: 'my_tool', arguments: 'not-json' } },
                ],
              },
            ],
          } as unknown as DispatchBody),
        ).rejects.toThrow(
          new AIBadRequestError(
            "Invalid JSON in tool_calls arguments for tool 'my_tool': not-json",
          ),
        );
      });
    });

    describe('convertToolChoiceToLangChain edge cases', () => {
      it('should convert tool_choice "none" to "none"', async () => {
        const mockResponse = new AIMessage({ content: 'Response' });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [{ type: 'function', function: { name: 'tool1' } }],
          messages: [{ role: 'user', content: 'test' }],
          tool_choice: 'none',
        } as unknown as DispatchBody);

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: 'none',
        });
      });

      it('should return undefined for unrecognized tool_choice value', async () => {
        const mockResponse = new AIMessage({ content: 'Response' });
        anthropicInvokeMock.mockResolvedValueOnce(mockResponse);

        const dispatcher = new ProviderDispatcher(
          {
            name: 'claude',
            provider: 'anthropic',
            apiKey: 'test-api-key',
            model: 'claude-3-5-sonnet-latest',
          },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [{ type: 'function', function: { name: 'tool1' } }],
          messages: [{ role: 'user', content: 'test' }],
          tool_choice: { type: 'unknown' },
        } as unknown as DispatchBody);

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: undefined,
        });
      });
    });
  });
});
