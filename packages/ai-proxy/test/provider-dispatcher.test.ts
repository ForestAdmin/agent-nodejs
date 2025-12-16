import type { DispatchBody } from '../src';

import { AINotConfiguredError, ProviderDispatcher, RemoteTools } from '../src';

const openaiCreateMock = jest.fn();
const mistralCompleteMock = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: openaiCreateMock } },
  }));
});

jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn().mockImplementation(() => ({
    chat: { complete: mistralCompleteMock },
  })),
}));

describe('ProviderDispatcher', () => {
  const apiKeys = { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'api-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    openaiCreateMock.mockResolvedValue({
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1234567890,
      model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'OpenAI response' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
    mistralCompleteMock.mockResolvedValue({
      id: 'mistral-123',
      model: 'mistral-large-latest',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Mistral response' }, finishReason: 'stop' }],
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
    });
  });

  describe('dispatch', () => {
    describe('when AI is not configured', () => {
      it('should throw AINotConfiguredError', async () => {
        const dispatcher = new ProviderDispatcher(null, new RemoteTools(apiKeys));
        await expect(dispatcher.dispatch({} as DispatchBody)).rejects.toThrow(AINotConfiguredError);
        await expect(dispatcher.dispatch({} as DispatchBody)).rejects.toThrow(
          'AI is not configured. Please call addAI() on your agent.',
        );
      });
    });
  });

  describe('openai', () => {
    describe('when openai is configured', () => {
      it('should return the response from openai directly', async () => {
        const dispatcher = new ProviderDispatcher(
          { provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
          new RemoteTools(apiKeys),
        );

        const response = (await dispatcher.dispatch({
          tools: [],
          messages: [{ role: 'user', content: 'Hello' }],
        } as unknown as DispatchBody)) as { choices: Array<{ message: { content: string } }> };

        expect(response.choices[0].message.content).toBe('OpenAI response');
      });

      it('should call openai with the configured model', async () => {
        const dispatcher = new ProviderDispatcher(
          { provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [],
          messages: [{ role: 'user', content: 'Hello' }],
        } as unknown as DispatchBody);

        expect(openaiCreateMock).toHaveBeenCalledWith(
          expect.objectContaining({ model: 'gpt-4o' }),
        );
      });

      describe('when the openai client throws an error', () => {
        it('should throw an OpenAIUnprocessableError', async () => {
          openaiCreateMock.mockRejectedValueOnce(new Error('OpenAI error'));

          const dispatcher = new ProviderDispatcher(
            { provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
            new RemoteTools(apiKeys),
          );

          await expect(
            dispatcher.dispatch({
              tools: [],
              messages: [{ role: 'user', content: 'test' }],
            } as unknown as DispatchBody),
          ).rejects.toThrow('Error while calling OpenAI: OpenAI error');
        });
      });
    });
  });

  describe('mistral', () => {
    describe('when mistral is configured', () => {
      it('should return the response converted to OpenAI format', async () => {
        const dispatcher = new ProviderDispatcher(
          { provider: 'mistral', apiKey: 'mistral-key', model: 'mistral-large-latest' },
          new RemoteTools(apiKeys),
        );

        const response = (await dispatcher.dispatch({
          tools: [],
          messages: [{ role: 'user', content: 'Hello' }],
        } as unknown as DispatchBody)) as {
          choices: Array<{ message: { content: string } }>;
          object: string;
          model: string;
          usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        expect(response.choices[0].message.content).toBe('Mistral response');
        expect(response.object).toBe('chat.completion');
        expect(response.model).toBe('mistral-large-latest');
        expect(response.usage).toEqual({
          prompt_tokens: 5,
          completion_tokens: 10,
          total_tokens: 15,
        });
      });

      it('should call mistral with the configured model', async () => {
        const dispatcher = new ProviderDispatcher(
          { provider: 'mistral', apiKey: 'mistral-key', model: 'mistral-large-latest' },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [],
          messages: [{ role: 'user', content: 'Hello' }],
        } as unknown as DispatchBody);

        expect(mistralCompleteMock).toHaveBeenCalledWith(
          expect.objectContaining({ model: 'mistral-large-latest' }),
        );
      });

      describe('when the mistral client throws an error', () => {
        it('should throw a MistralUnprocessableError', async () => {
          mistralCompleteMock.mockRejectedValueOnce(new Error('Mistral error'));

          const dispatcher = new ProviderDispatcher(
            { provider: 'mistral', apiKey: 'mistral-key', model: 'mistral-large-latest' },
            new RemoteTools(apiKeys),
          );

          await expect(
            dispatcher.dispatch({
              tools: [],
              messages: [{ role: 'user', content: 'test' }],
            } as unknown as DispatchBody),
          ).rejects.toThrow('Error while calling Mistral: Mistral error');
        });
      });
    });

    describe('when mistral returns tool calls', () => {
      it('should convert tool calls to OpenAI format', async () => {
        mistralCompleteMock.mockResolvedValueOnce({
          id: 'mistral-123',
          model: 'mistral-large-latest',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                toolCalls: [
                  {
                    id: 'call_123',
                    function: { name: 'myTool', arguments: '{"param1":"value1"}' },
                  },
                ],
              },
              finishReason: 'tool_calls',
            },
          ],
          usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        });

        const dispatcher = new ProviderDispatcher(
          { provider: 'mistral', apiKey: 'mistral-key', model: 'mistral-large-latest' },
          new RemoteTools(apiKeys),
        );

        const response = (await dispatcher.dispatch({
          tools: [],
          messages: [{ role: 'user', content: 'test' }],
        } as unknown as DispatchBody)) as {
          choices: Array<{
            message: { tool_calls: Array<{ id: string; function: { name: string; arguments: string } }> };
            finish_reason: string;
          }>;
        };

        expect(response.choices[0].message.tool_calls).toEqual([
          {
            id: 'call_123',
            type: 'function',
            function: { name: 'myTool', arguments: '{"param1":"value1"}' },
          },
        ]);
        expect(response.choices[0].finish_reason).toBe('tool_calls');
      });
    });
  });

  describe('remote tools enhancement', () => {
    it('should enhance remote tools with full definition', async () => {
      const remoteTools = new RemoteTools(apiKeys);

      const dispatcher = new ProviderDispatcher(
        { provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
        remoteTools,
      );

      await dispatcher.dispatch({
        tools: [
          {
            type: 'function',
            function: { name: remoteTools.tools[0].base.name, parameters: {} },
          },
        ],
        messages: [{ role: 'user', content: 'Hello' }],
      } as unknown as DispatchBody);

      expect(openaiCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              type: 'function',
              function: {
                name: remoteTools.tools[0].base.name,
                description: remoteTools.tools[0].base.description,
                parameters: remoteTools.tools[0].base.schema,
              },
            },
          ],
        }),
      );
    });
  });
});
