import type { DispatchBody } from '../src';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';

import { AINotConfiguredError, ProviderDispatcher, RemoteTools } from '../src';

const openaiCreateMock = jest.fn().mockResolvedValue('response');

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return { chat: { completions: { create: openaiCreateMock } } };
  });
});

const mistralInvokeMock = jest.fn().mockResolvedValue({
  content: 'Mistral response',
  tool_calls: [],
  response_metadata: {
    tokenUsage: {
      completionTokens: 10,
      promptTokens: 5,
      totalTokens: 15,
    },
  },
});

const mistralBindToolsMock = jest.fn().mockReturnValue({
  invoke: mistralInvokeMock,
});

jest.mock('@langchain/mistralai', () => {
  return {
    ChatMistralAI: jest.fn().mockImplementation(() => {
      return {
        invoke: mistralInvokeMock,
        bindTools: mistralBindToolsMock,
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
          'AI is not configured. Please call addAI() on your agent.',
        );
      });
    });
  });

  describe('openai', () => {
    describe('when openai is configured', () => {
      it('should return the response from openai', async () => {
        const dispatcher = new ProviderDispatcher(
          {
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
        expect(response).toBe('response');
      });

      describe('when the user tries to override the configuration', () => {
        it('should not allow the user to override the configuration', async () => {
          const dispatcher = new ProviderDispatcher(
            {
              provider: 'openai',
              apiKey: 'dev',
              model: 'BASE MODEL',
            },
            new RemoteTools(apiKeys),
          );
          await dispatcher.dispatch({
            model: 'OTHER MODEL',
            propertyInjection: 'hack',

            tools: [],
            messages: [],
            tool_choice: 'auto',
          } as unknown as DispatchBody);

          expect(openaiCreateMock).toHaveBeenCalledWith({
            model: 'BASE MODEL',
            tools: [],
            messages: [],
            tool_choice: 'auto',
          });
        });
      });

      describe('when the openai client throws an error', () => {
        it('should throw an OpenAIUnprocessableError', async () => {
          const dispatcher = new ProviderDispatcher(
            {
              provider: 'openai',
              apiKey: 'dev',
              model: 'gpt-4o',
            },
            new RemoteTools(apiKeys),
          );
          openaiCreateMock.mockRejectedValueOnce(new Error('OpenAI error'));

          await expect(
            dispatcher.dispatch({ tools: [], messages: [] } as unknown as DispatchBody),
          ).rejects.toThrow('Error while calling OpenAI: OpenAI error');
        });
      });
    });

    describe('when there is a remote tool', () => {
      it('should enhance the remote tools definition', async () => {
        const remoteTools = new RemoteTools(apiKeys);
        remoteTools.invokeTool = jest.fn().mockResolvedValue('response');

        const dispatcher = new ProviderDispatcher(
          {
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
          remoteTools,
        );
        await dispatcher.dispatch({
          tools: [
            {
              type: 'function',
              // parameters is an empty object because it simulates the front end sending an empty object
              // because it doesn't know the parameters of the tool
              function: { name: remoteTools.tools[0].base.name, parameters: {} },
            },
          ],
          messages: [],
        } as unknown as DispatchBody);

        expect(openaiCreateMock).toHaveBeenCalledWith({
          messages: [],
          model: 'gpt-4o',
          tool_choice: undefined,
          tools: [
            {
              type: 'function',
              function: convertToOpenAIFunction(remoteTools.tools[0].base),
            },
          ],
        });
      });
    });

    describe('when there is not remote tool', () => {
      it('should not enhance the remote tools definition', async () => {
        const remoteTools = new RemoteTools(apiKeys);
        remoteTools.invokeTool = jest.fn().mockResolvedValue('response');

        const dispatcher = new ProviderDispatcher(
          {
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
          remoteTools,
        );
        await dispatcher.dispatch({
          tools: [
            {
              type: 'function',
              function: { name: 'notRemoteTool', parameters: {} },
            },
          ],
          messages: [],
        } as unknown as DispatchBody);

        expect(openaiCreateMock).toHaveBeenCalledWith({
          messages: [],
          model: 'gpt-4o',
          tool_choice: undefined,
          tools: [
            {
              type: 'function',
              function: { name: 'notRemoteTool', parameters: {} },
            },
          ],
        });
      });
    });
  });

  describe('mistral', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('when mistral is configured', () => {
      it('should return the response in OpenAI format', async () => {
        const dispatcher = new ProviderDispatcher(
          {
            provider: 'mistral',
            apiKey: 'mistral-key',
            model: 'mistral-large-latest',
          },
          new RemoteTools(apiKeys),
        );

        const response = (await dispatcher.dispatch({
          tools: [],
          messages: [],
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

      describe('when the user tries to override the configuration', () => {
        it('should not allow the user to override the model', async () => {
          const dispatcher = new ProviderDispatcher(
            {
              provider: 'mistral',
              apiKey: 'mistral-key',
              model: 'mistral-large-latest',
            },
            new RemoteTools(apiKeys),
          );

          const response = (await dispatcher.dispatch({
            model: 'OTHER MODEL',
            propertyInjection: 'hack',
            tools: [],
            messages: [{ role: 'user', content: 'Hello' }],
          } as unknown as DispatchBody)) as { model: string };

          expect(response.model).toBe('mistral-large-latest');
          expect(mistralInvokeMock).toHaveBeenCalled();
        });
      });

      describe('when the mistral client throws an error', () => {
        it('should throw a MistralUnprocessableError', async () => {
          mistralInvokeMock.mockRejectedValueOnce(new Error('Mistral error'));

          const dispatcher = new ProviderDispatcher(
            {
              provider: 'mistral',
              apiKey: 'mistral-key',
              model: 'mistral-large-latest',
            },
            new RemoteTools(apiKeys),
          );

          await expect(
            dispatcher.dispatch({ tools: [], messages: [] } as unknown as DispatchBody),
          ).rejects.toThrow('Error while calling Mistral: Mistral error');
        });
      });
    });

    describe('when there are tools', () => {
      it('should bind tools to the Mistral client', async () => {
        const dispatcher = new ProviderDispatcher(
          {
            provider: 'mistral',
            apiKey: 'mistral-key',
            model: 'mistral-large-latest',
          },
          new RemoteTools(apiKeys),
        );

        await dispatcher.dispatch({
          tools: [
            {
              type: 'function',
              function: { name: 'myTool', parameters: { type: 'object' } },
            },
          ],
          messages: [],
          tool_choice: 'auto',
        } as unknown as DispatchBody);

        expect(mistralBindToolsMock).toHaveBeenCalledWith(
          [{ type: 'function', function: { name: 'myTool', parameters: { type: 'object' } } }],
          { tool_choice: 'auto' },
        );
      });
    });

    describe('when mistral returns tool calls', () => {
      it('should convert tool calls to OpenAI format', async () => {
        mistralInvokeMock.mockResolvedValueOnce({
          content: '',
          tool_calls: [
            {
              id: 'call_123',
              name: 'myTool',
              args: { param1: 'value1' },
            },
          ],
          response_metadata: {},
        });

        const dispatcher = new ProviderDispatcher(
          {
            provider: 'mistral',
            apiKey: 'mistral-key',
            model: 'mistral-large-latest',
          },
          new RemoteTools(apiKeys),
        );

        const response = (await dispatcher.dispatch({
          tools: [],
          messages: [],
        } as unknown as DispatchBody)) as {
          choices: Array<{
            message: { tool_calls: Array<{ id: string; function: { arguments: string } }> };
            finish_reason: string;
          }>;
        };

        expect(response.choices[0].message.tool_calls).toEqual([
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'myTool',
              arguments: '{"param1":"value1"}',
            },
          },
        ]);
        expect(response.choices[0].finish_reason).toBe('tool_calls');
      });
    });
  });
});
