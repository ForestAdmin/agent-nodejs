import type { DispatchBody } from '../src';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';

import { AINotConfiguredError, ProviderDispatcher, RemoteTools } from '../src';

const openaiCreateMock = jest.fn().mockResolvedValue('response');

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return { chat: { completions: { create: openaiCreateMock } } };
  });
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
        expect(response).toBe('response');
      });

      describe('when the user tries to override the configuration', () => {
        it('should not allow the user to override the configuration', async () => {
          const dispatcher = new ProviderDispatcher(
            {
              name: 'base',
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
              name: 'gpt4',
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
            name: 'gpt4',
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
            name: 'gpt4',
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
});
