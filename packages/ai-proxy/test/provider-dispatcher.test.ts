import type { DispatchBody } from '../src';

import { AIMessage } from '@langchain/core/messages';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import {
  AIAuthenticationError,
  AIBadRequestError,
  AINotConfiguredError,
  AIProviderError,
  AIRateLimitError,
  AIUnprocessableError,
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
  const response = new AIMessage({ content });
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

    it('should throw AIBadRequestError for unknown provider', () => {
      expect(
        () =>
          new ProviderDispatcher(
            { provider: 'unknown', name: 'test', model: 'x' } as any,
            new RemoteTools(apiKeys),
          ),
      ).toThrow(new AIBadRequestError("Unsupported AI provider 'unknown'."));
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
      it('should wrap generic errors as AIProviderError with cause', async () => {
        const original = new Error('OpenAI error');
        invokeMock.mockRejectedValueOnce(original);

        const thrown = await dispatcher.dispatch(buildBody()).catch(e => e);

        expect(thrown).toBeInstanceOf(AIProviderError);
        expect(thrown.message).toBe('Error while calling OpenAI: OpenAI error');
        expect(thrown.provider).toBe('OpenAI');
        expect(thrown.cause).toBe(original);
      });

      it('should wrap 429 as AIRateLimitError', async () => {
        const error = Object.assign(new Error('Too many requests'), { status: 429 });
        invokeMock.mockRejectedValueOnce(error);

        const thrown = await dispatcher.dispatch(buildBody()).catch(e => e);

        expect(thrown).toBeInstanceOf(AIRateLimitError);
        expect(thrown.message).toBe('OpenAI rate limit exceeded');
        expect(thrown.provider).toBe('OpenAI');
        expect(thrown.baseBusinessErrorName).toBe('TooManyRequestsError');
        expect(thrown.cause).toBe(error);
      });

      it('should wrap 401 as AIAuthenticationError', async () => {
        const error = Object.assign(new Error('Invalid API key'), { status: 401 });
        invokeMock.mockRejectedValueOnce(error);

        const thrown = await dispatcher.dispatch(buildBody()).catch(e => e);

        expect(thrown).toBeInstanceOf(AIAuthenticationError);
        expect(thrown.message).toBe('OpenAI authentication failed: check your API key configuration');
        expect(thrown.provider).toBe('OpenAI');
        expect(thrown.baseBusinessErrorName).toBe('UnauthorizedError');
        expect(thrown.cause).toBe(error);
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

    it('should not forward user-supplied model from body to the LLM', async () => {
      const { ChatAnthropic } = jest.requireMock('@langchain/anthropic');
      mockAnthropicResponse();

      await dispatcher.dispatch(
        buildBody({
          model: 'OTHER MODEL',
          messages: [{ role: 'user', content: 'Hello' }],
        } as unknown as DispatchBody),
      );

      expect(ChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-3-5-sonnet-latest' }),
      );
      expect(ChatAnthropic).not.toHaveBeenCalledWith(
        expect.objectContaining({ model: 'OTHER MODEL' }),
      );
    });

    it('should return an OpenAI-compatible response', async () => {
      mockAnthropicResponse('Hello from Claude', {
        id: 'msg_123',
        usage_metadata: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      });

      const response = await dispatcher.dispatch(
        buildBody({ messages: [{ role: 'user', content: 'Hello' }] }),
      );

      expect(response).toEqual(
        expect.objectContaining({
          id: 'msg_123',
          object: 'chat.completion',
          model: 'claude-3-5-sonnet-latest',
          choices: [
            expect.objectContaining({
              message: expect.objectContaining({
                role: 'assistant',
                content: 'Hello from Claude',
              }),
              finish_reason: 'stop',
            }),
          ],
        }),
      );
    });

    describe('tool binding', () => {
      it('should bind tools and pass converted tool_choice to Anthropic', async () => {
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

    describe('error handling', () => {
      it('should wrap generic errors as AIProviderError with cause', async () => {
        const original = new Error('Anthropic API error');
        anthropicInvokeMock.mockRejectedValueOnce(original);

        const thrown = await dispatcher
          .dispatch(buildBody({ messages: [{ role: 'user', content: 'Hello' }] }))
          .catch(e => e);

        expect(thrown).toBeInstanceOf(AIProviderError);
        expect(thrown.message).toBe('Error while calling Anthropic: Anthropic API error');
        expect(thrown.provider).toBe('Anthropic');
        expect(thrown.cause).toBe(original);
      });

      it('should wrap 429 as AIRateLimitError', async () => {
        const error = Object.assign(new Error('Too many requests'), { status: 429 });
        anthropicInvokeMock.mockRejectedValueOnce(error);

        const thrown = await dispatcher
          .dispatch(buildBody({ messages: [{ role: 'user', content: 'Hello' }] }))
          .catch(e => e);

        expect(thrown).toBeInstanceOf(AIRateLimitError);
        expect(thrown.message).toBe('Anthropic rate limit exceeded');
        expect(thrown.provider).toBe('Anthropic');
        expect(thrown.baseBusinessErrorName).toBe('TooManyRequestsError');
        expect(thrown.cause).toBe(error);
      });

      it('should wrap 401 as AIAuthenticationError', async () => {
        const error = Object.assign(new Error('Invalid API key'), { status: 401 });
        anthropicInvokeMock.mockRejectedValueOnce(error);

        const thrown = await dispatcher
          .dispatch(buildBody({ messages: [{ role: 'user', content: 'Hello' }] }))
          .catch(e => e);

        expect(thrown).toBeInstanceOf(AIAuthenticationError);
        expect(thrown.message).toBe('Anthropic authentication failed: check your API key configuration');
        expect(thrown.provider).toBe('Anthropic');
        expect(thrown.baseBusinessErrorName).toBe('UnauthorizedError');
        expect(thrown.cause).toBe(error);
      });

      it('should handle non-Error throws gracefully', async () => {
        anthropicInvokeMock.mockRejectedValueOnce('string error');

        const thrown = await dispatcher
          .dispatch(buildBody({ messages: [{ role: 'user', content: 'Hello' }] }))
          .catch(e => e);

        expect(thrown).toBeInstanceOf(AIProviderError);
        expect(thrown.message).toBe('Error while calling Anthropic: "string error"');
      });

      it('should not wrap conversion errors as provider errors', async () => {
        await expect(
          dispatcher.dispatch(
            buildBody({
              messages: [{ role: 'tool', content: 'result' }],
            }),
          ),
        ).rejects.toThrow(AIBadRequestError);
      });
    });
  });
});
