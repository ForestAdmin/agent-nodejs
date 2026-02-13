import type { DispatchBody } from '../src';

import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import {
  AIBadRequestError,
  AINotConfiguredError,
  AnthropicUnprocessableError,
  OpenAIUnprocessableError,
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

jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation(() => ({
    invoke: anthropicInvokeMock,
    bindTools: anthropicBindToolsMock,
  })),
}));

function buildBody(overrides: Partial<DispatchBody> = {}): DispatchBody {
  return { tools: [], messages: [], ...overrides } as unknown as DispatchBody;
}

function mockAnthropicResponse(
  content: AIMessage['content'] = 'Response',
  extra?: Record<string, unknown>,
): AIMessage {
  const response = new AIMessage(typeof content === 'string' ? { content } : { content });
  if (extra) Object.assign(response, extra);
  anthropicInvokeMock.mockResolvedValueOnce(response);

  return response;
}

describe('ProviderDispatcher', () => {
  const apiKeys = { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'api-key' };

  const openaiConfig = {
    name: 'gpt4',
    provider: 'openai' as const,
    apiKey: 'dev',
    model: 'gpt-4o',
  };

  const anthropicConfig = {
    name: 'claude',
    provider: 'anthropic' as const,
    apiKey: 'test-api-key',
    model: 'claude-3-5-sonnet-latest',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatch', () => {
    it('should throw AINotConfiguredError when no provider is configured', async () => {
      const dispatcher = new ProviderDispatcher(null, new RemoteTools(apiKeys));

      await expect(dispatcher.dispatch(buildBody())).rejects.toThrow(AINotConfiguredError);
      await expect(dispatcher.dispatch(buildBody())).rejects.toThrow('AI is not configured');
    });
  });

  describe('openai', () => {
    let dispatcher: ProviderDispatcher;

    beforeEach(() => {
      dispatcher = new ProviderDispatcher(openaiConfig, new RemoteTools(apiKeys));
    });

    it('should return the raw OpenAI response', async () => {
      const response = await dispatcher.dispatch(buildBody());

      expect(response).toEqual(mockOpenAIResponse);
    });

    it('should not forward user-supplied model or arbitrary properties to the LLM', async () => {
      const customConfig = { ...openaiConfig, name: 'base', model: 'BASE MODEL' };
      const customDispatcher = new ProviderDispatcher(customConfig, new RemoteTools(apiKeys));

      await customDispatcher.dispatch(
        buildBody({
          model: 'OTHER MODEL',
          messages: [{ role: 'user', content: 'Hello' }],
        } as unknown as DispatchBody),
      );

      expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ model: 'BASE MODEL' }));
      expect(ChatOpenAI).not.toHaveBeenCalledWith(
        expect.objectContaining({ model: 'OTHER MODEL' }),
      );
    });

    describe('error handling', () => {
      it('should wrap generic errors as OpenAIUnprocessableError', async () => {
        invokeMock.mockRejectedValueOnce(new Error('OpenAI error'));

        const thrown = await dispatcher.dispatch(buildBody()).catch(e => e);

        expect(thrown).toBeInstanceOf(OpenAIUnprocessableError);
        expect(thrown.message).toBe('Error while calling OpenAI: OpenAI error');
      });

      it('should wrap 429 as OpenAIUnprocessableError with rate limit message', async () => {
        const error = Object.assign(new Error('Too many requests'), { status: 429 });
        invokeMock.mockRejectedValueOnce(error);

        const thrown = await dispatcher.dispatch(buildBody()).catch(e => e);

        expect(thrown).toBeInstanceOf(OpenAIUnprocessableError);
        expect(thrown.message).toBe('Rate limit exceeded: Too many requests');
      });

      it('should wrap 401 as OpenAIUnprocessableError with auth message', async () => {
        const error = Object.assign(new Error('Invalid API key'), { status: 401 });
        invokeMock.mockRejectedValueOnce(error);

        const thrown = await dispatcher.dispatch(buildBody()).catch(e => e);

        expect(thrown).toBeInstanceOf(OpenAIUnprocessableError);
        expect(thrown.message).toBe('Authentication failed: Invalid API key');
      });

      it('should throw when rawResponse is missing', async () => {
        invokeMock.mockResolvedValueOnce({
          content: 'response',
          additional_kwargs: { __raw_response: null },
        });

        await expect(dispatcher.dispatch(buildBody())).rejects.toThrow(
          'OpenAI response missing raw response data. This may indicate an API change.',
        );
      });
    });

    describe('remote tools', () => {
      it('should enhance remote tools definition with full schema', async () => {
        const remoteTools = new RemoteTools(apiKeys);
        const remoteDispatcher = new ProviderDispatcher(openaiConfig, remoteTools);

        await remoteDispatcher.dispatch(
          buildBody({
            tools: [
              {
                type: 'function',
                // Front end sends empty parameters because it doesn't know the tool schema
                function: { name: remoteTools.tools[0].base.name, parameters: {} },
              },
            ],
            messages: [{ role: 'user', content: 'test' }],
          }),
        );

        expect(bindToolsMock).toHaveBeenCalledWith(
          [
            {
              type: 'function',
              function: convertToOpenAIFunction(remoteTools.tools[0].base),
            },
          ],
          { tool_choice: undefined },
        );
      });

      it('should not modify non-remote tools', async () => {
        const remoteDispatcher = new ProviderDispatcher(openaiConfig, new RemoteTools(apiKeys));

        await remoteDispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'notRemoteTool', parameters: {} } }],
            messages: [{ role: 'user', content: 'test' }],
          }),
        );

        expect(bindToolsMock).toHaveBeenCalledWith(
          [{ type: 'function', function: { name: 'notRemoteTool', parameters: {} } }],
          { tool_choice: undefined },
        );
      });
    });

    describe('parallel_tool_calls', () => {
      it('should pass parallel_tool_calls: false to bindTools', async () => {
        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'test', parameters: {} } }],
            messages: [{ role: 'user', content: 'test' }],
            tool_choice: 'auto',
            parallel_tool_calls: false,
          }),
        );

        expect(bindToolsMock).toHaveBeenCalledWith(expect.any(Array), {
          tool_choice: 'auto',
          parallel_tool_calls: false,
        });
      });

      it('should pass parallel_tool_calls: true to bindTools', async () => {
        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'test', parameters: {} } }],
            messages: [{ role: 'user', content: 'test' }],
            parallel_tool_calls: true,
          }),
        );

        expect(bindToolsMock).toHaveBeenCalledWith(expect.any(Array), {
          tool_choice: undefined,
          parallel_tool_calls: true,
        });
      });
    });
  });

  describe('anthropic', () => {
    let dispatcher: ProviderDispatcher;

    beforeEach(() => {
      dispatcher = new ProviderDispatcher(anthropicConfig, new RemoteTools(apiKeys));
    });

    describe('response conversion to OpenAI format', () => {
      it('should return a complete OpenAI-compatible response', async () => {
        const mockResponse = mockAnthropicResponse('Hello from Claude', {
          id: 'msg_123',
          usage_metadata: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        });

        const response = await dispatcher.dispatch(
          buildBody({ messages: [{ role: 'user', content: 'Hello' }] }),
        );

        expect(response).toEqual(
          expect.objectContaining({
            id: mockResponse.id,
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
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          }),
        );
      });

      it('should default usage to zeros when usage_metadata is missing', async () => {
        mockAnthropicResponse('Response');

        const response = await dispatcher.dispatch(
          buildBody({ messages: [{ role: 'user', content: 'test' }] }),
        );

        expect(response.usage).toEqual({
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        });
      });

      it('should return null content for empty string responses', async () => {
        mockAnthropicResponse('');

        const response = await dispatcher.dispatch(
          buildBody({ messages: [{ role: 'user', content: 'test' }] }),
        );

        expect(response.choices[0].message.content).toBeNull();
      });

      it('should extract text from array content blocks', async () => {
        mockAnthropicResponse(
          [
            { type: 'text', text: 'Here is the result' },
            { type: 'tool_use', id: 'call_1', name: 'search', input: { q: 'test' } },
          ],
          { tool_calls: [{ id: 'call_1', name: 'search', args: { q: 'test' } }] },
        );

        const response = await dispatcher.dispatch(
          buildBody({ messages: [{ role: 'user', content: 'Search' }] }),
        );

        expect(response.choices[0].message.content).toBe('Here is the result');
        expect(response.choices[0].message.tool_calls).toHaveLength(1);
      });

      it('should return null content when array has no text blocks', async () => {
        mockAnthropicResponse(
          [{ type: 'tool_use', id: 'call_1', name: 'search', input: { q: 'test' } }],
          { tool_calls: [{ id: 'call_1', name: 'search', args: { q: 'test' } }] },
        );

        const response = await dispatcher.dispatch(
          buildBody({ messages: [{ role: 'user', content: 'Search' }] }),
        );

        expect(response.choices[0].message.content).toBeNull();
      });

      it('should convert tool_calls to OpenAI format with finish_reason "tool_calls"', async () => {
        mockAnthropicResponse('', {
          tool_calls: [{ id: 'call_456', name: 'search', args: { query: 'test' } }],
        });

        const response = await dispatcher.dispatch(
          buildBody({ messages: [{ role: 'user', content: 'Search for test' }] }),
        );

        expect(response.choices[0].message.tool_calls).toEqual([
          {
            id: 'call_456',
            type: 'function',
            function: { name: 'search', arguments: '{"query":"test"}' },
          },
        ]);
        expect(response.choices[0].finish_reason).toBe('tool_calls');
      });

      it('should generate a UUID fallback when tool_call has no id', async () => {
        mockAnthropicResponse('', {
          tool_calls: [{ name: 'search', args: { q: 'test' } }],
        });

        const response = await dispatcher.dispatch(
          buildBody({ messages: [{ role: 'user', content: 'test' }] }),
        );

        expect(response.choices[0].message.tool_calls![0].id).toMatch(/^call_/);
      });

      it('should generate a UUID fallback when response has no id', async () => {
        mockAnthropicResponse('Hello');

        const response = await dispatcher.dispatch(
          buildBody({ messages: [{ role: 'user', content: 'test' }] }),
        );

        expect(response.id).toMatch(/^msg_/);
      });
    });

    describe('message conversion to LangChain format', () => {
      it('should convert each role to the correct LangChain message type', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            messages: [
              { role: 'system', content: 'You are helpful' },
              { role: 'user', content: 'Hello' },
              { role: 'assistant', content: 'Hi there' },
            ],
          }),
        );

        expect(anthropicInvokeMock).toHaveBeenCalledWith([
          expect.any(SystemMessage),
          expect.any(HumanMessage),
          expect.any(AIMessage),
        ]);
        expect(anthropicInvokeMock).toHaveBeenCalledWith([
          expect.objectContaining({ content: 'You are helpful' }),
          expect.objectContaining({ content: 'Hello' }),
          expect.objectContaining({ content: 'Hi there' }),
        ]);
      });

      it('should convert assistant tool_calls with parsed JSON arguments', async () => {
        mockAnthropicResponse('Done');

        await dispatcher.dispatch(
          buildBody({
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
          }),
        );

        expect(anthropicInvokeMock).toHaveBeenCalledWith([
          expect.objectContaining({
            content: '',
            tool_calls: [{ id: 'call_123', name: 'get_weather', args: { city: 'Paris' } }],
          }),
          expect.any(ToolMessage),
        ]);
      });

      it('should throw AIBadRequestError for tool message without tool_call_id', async () => {
        await expect(
          dispatcher.dispatch(buildBody({ messages: [{ role: 'tool', content: 'result' }] })),
        ).rejects.toThrow(
          new AIBadRequestError('Tool message is missing required "tool_call_id" field.'),
        );
      });

      it('should throw AIBadRequestError for unsupported message role', async () => {
        await expect(
          dispatcher.dispatch(
            buildBody({ messages: [{ role: 'unknown', content: 'test' }] } as any),
          ),
        ).rejects.toThrow(
          new AIBadRequestError(
            "Unsupported message role 'unknown'. Expected: system, user, assistant, or tool.",
          ),
        );
      });

      it('should throw AIBadRequestError for invalid JSON in tool_calls arguments', async () => {
        await expect(
          dispatcher.dispatch(
            buildBody({
              messages: [
                {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    { id: 'call_1', function: { name: 'my_tool', arguments: 'not-json' } },
                  ],
                },
              ],
            }),
          ),
        ).rejects.toThrow(
          new AIBadRequestError(
            "Invalid JSON in tool_calls arguments for tool 'my_tool': not-json",
          ),
        );
      });
    });

    describe('tool binding', () => {
      it('should bind tools with the correct tool_choice', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
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
          }),
        );

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

      it('should enhance remote tools definition with full schema', async () => {
        mockAnthropicResponse();
        const remoteTools = new RemoteTools(apiKeys);
        const remoteDispatcher = new ProviderDispatcher(anthropicConfig, remoteTools);

        await remoteDispatcher.dispatch(
          buildBody({
            tools: [
              {
                type: 'function',
                function: { name: remoteTools.tools[0].base.name, parameters: {} },
              },
            ],
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(
          [{ type: 'function', function: convertToOpenAIFunction(remoteTools.tools[0].base) }],
          expect.anything(),
        );
      });
    });

    describe('tool_choice conversion', () => {
      it('should convert "required" to "any"', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'tool1' } }],
            tool_choice: 'required',
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: 'any',
        });
      });

      it('should convert specific function to { type: "tool", name }', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'specific_tool' } }],
            tool_choice: { type: 'function', function: { name: 'specific_tool' } },
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: { type: 'tool', name: 'specific_tool' },
        });
      });

      it('should pass "none" through unchanged', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'tool1' } }],
            tool_choice: 'none',
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: 'none',
        });
      });

      it('should throw AIBadRequestError for unrecognized tool_choice', async () => {
        await expect(
          dispatcher.dispatch(
            buildBody({
              tools: [{ type: 'function', function: { name: 'tool1' } }],
              messages: [{ role: 'user', content: 'test' }],
              tool_choice: { type: 'unknown' },
            } as any),
          ),
        ).rejects.toThrow(AIBadRequestError);
      });
    });

    describe('parallel_tool_calls', () => {
      it('should set disable_parallel_tool_use when parallel_tool_calls is false with "required"', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'test', parameters: {} } }],
            messages: [{ role: 'user', content: 'test' }],
            tool_choice: 'required',
            parallel_tool_calls: false,
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: { type: 'any', disable_parallel_tool_use: true },
        });
      });

      it('should default to auto with disable_parallel_tool_use when no tool_choice', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'test', parameters: {} } }],
            messages: [{ role: 'user', content: 'test' }],
            parallel_tool_calls: false,
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: { type: 'auto', disable_parallel_tool_use: true },
        });
      });

      it('should add disable_parallel_tool_use to specific function tool_choice', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'specific_tool' } }],
            messages: [{ role: 'user', content: 'test' }],
            tool_choice: { type: 'function', function: { name: 'specific_tool' } },
            parallel_tool_calls: false,
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: { type: 'tool', name: 'specific_tool', disable_parallel_tool_use: true },
        });
      });

      it('should not set disable_parallel_tool_use when parallel_tool_calls is true', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'test', parameters: {} } }],
            messages: [{ role: 'user', content: 'test' }],
            tool_choice: 'required',
            parallel_tool_calls: true,
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: 'any',
        });
      });

      it('should pass "none" unchanged even when parallel_tool_calls is false', async () => {
        mockAnthropicResponse();

        await dispatcher.dispatch(
          buildBody({
            tools: [{ type: 'function', function: { name: 'tool1' } }],
            messages: [{ role: 'user', content: 'test' }],
            tool_choice: 'none',
            parallel_tool_calls: false,
          }),
        );

        expect(anthropicBindToolsMock).toHaveBeenCalledWith(expect.anything(), {
          tool_choice: 'none',
        });
      });
    });

    describe('error handling', () => {
      it('should wrap generic errors as AnthropicUnprocessableError', async () => {
        anthropicInvokeMock.mockRejectedValueOnce(new Error('Anthropic API error'));

        await expect(
          dispatcher.dispatch(buildBody({ messages: [{ role: 'user', content: 'Hello' }] })),
        ).rejects.toThrow(AnthropicUnprocessableError);
      });

      it('should wrap 429 as AnthropicUnprocessableError with rate limit message', async () => {
        const error = Object.assign(new Error('Too many requests'), { status: 429 });
        anthropicInvokeMock.mockRejectedValueOnce(error);

        const thrown = await dispatcher
          .dispatch(buildBody({ messages: [{ role: 'user', content: 'Hello' }] }))
          .catch(e => e);

        expect(thrown).toBeInstanceOf(AnthropicUnprocessableError);
        expect(thrown.message).toBe('Rate limit exceeded: Too many requests');
      });

      it('should wrap 401 as AnthropicUnprocessableError with auth message', async () => {
        const error = Object.assign(new Error('Invalid API key'), { status: 401 });
        anthropicInvokeMock.mockRejectedValueOnce(error);

        const thrown = await dispatcher
          .dispatch(buildBody({ messages: [{ role: 'user', content: 'Hello' }] }))
          .catch(e => e);

        expect(thrown).toBeInstanceOf(AnthropicUnprocessableError);
        expect(thrown.message).toBe('Authentication failed: Invalid API key');
      });

      it('should preserve AIBadRequestError without wrapping', async () => {
        await expect(
          dispatcher.dispatch(
            buildBody({
              tools: [{ type: 'function', function: { name: 'tool1' } }],
              messages: [{ role: 'user', content: 'test' }],
              tool_choice: { type: 'unknown' },
            } as any),
          ),
        ).rejects.toThrow(AIBadRequestError);
      });
    });
  });
});
