import type { DispatchBody } from '../src';

import { AINotConfiguredError, ProviderDispatcher, RemoteTools } from '../src';

const invokeMock = jest.fn();
const bindToolsMock = jest.fn().mockReturnValue({ invoke: invokeMock });

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: invokeMock,
    bindTools: bindToolsMock,
  })),
}));

jest.mock('@langchain/mistralai', () => ({
  ChatMistralAI: jest.fn().mockImplementation(() => ({
    invoke: invokeMock,
    bindTools: bindToolsMock,
  })),
}));

describe('ProviderDispatcher', () => {
  const apiKeys = { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'api-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    invokeMock.mockResolvedValue({
      content: 'AI response',
      tool_calls: [],
      usage_metadata: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
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
      it('should return the response in OpenAI format', async () => {
        const dispatcher = new ProviderDispatcher(
          { provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
          new RemoteTools(apiKeys),
        );

        const response = (await dispatcher.dispatch({
          tools: [],
          messages: [{ role: 'user', content: 'Hello' }],
        } as unknown as DispatchBody)) as {
          choices: Array<{ message: { content: string } }>;
          object: string;
          model: string;
        };

        expect(response.choices[0].message.content).toBe('AI response');
        expect(response.object).toBe('chat.completion');
        expect(response.model).toBe('gpt-4o');
      });

      describe('when the client throws an error', () => {
        it('should throw an OpenAIUnprocessableError', async () => {
          invokeMock.mockRejectedValueOnce(new Error('OpenAI error'));

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
      it('should return the response in OpenAI format', async () => {
        invokeMock.mockResolvedValueOnce({
          content: 'Mistral response',
          tool_calls: [],
          response_metadata: {
            tokenUsage: {
              promptTokens: 5,
              completionTokens: 10,
              totalTokens: 15,
            },
          },
        });

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

      describe('when the client throws an error', () => {
        it('should throw a MistralUnprocessableError', async () => {
          invokeMock.mockRejectedValueOnce(new Error('Mistral error'));

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

    describe('when returning tool calls', () => {
      it('should convert tool calls to OpenAI format', async () => {
        invokeMock.mockResolvedValueOnce({
          content: '',
          tool_calls: [
            {
              id: 'call_123',
              name: 'myTool',
              args: { param1: 'value1' },
            },
          ],
          usage_metadata: { input_tokens: 5, output_tokens: 10, total_tokens: 15 },
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

  describe('tools', () => {
    it('should not bind tools when tools array is empty', async () => {
      const dispatcher = new ProviderDispatcher(
        { provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
        new RemoteTools(apiKeys),
      );

      await dispatcher.dispatch({
        tools: [],
        messages: [{ role: 'user', content: 'Hello' }],
      } as unknown as DispatchBody);

      expect(bindToolsMock).not.toHaveBeenCalled();
    });

    it('should bind tools when provided', async () => {
      const dispatcher = new ProviderDispatcher(
        { provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
        new RemoteTools(apiKeys),
      );

      await dispatcher.dispatch({
        tools: [
          {
            type: 'function',
            function: { name: 'myTool', description: 'A tool', parameters: {} },
          },
        ],
        messages: [{ role: 'user', content: 'Hello' }],
        tool_choice: 'auto',
      } as unknown as DispatchBody);

      expect(bindToolsMock).toHaveBeenCalled();
    });

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

      expect(bindToolsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({
              name: remoteTools.tools[0].base.name,
              description: remoteTools.tools[0].base.description,
            }),
          }),
        ]),
        expect.anything(),
      );
    });
  });
});
