import type { DispatchBody } from '../src';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';

import { ProviderDispatcher, RemoteTools } from '../src';

const openaiCreateMock = jest.fn().mockResolvedValue('response');

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return { chat: { completions: { create: openaiCreateMock } } };
  });
});

describe('ProviderDispatcher', () => {
  const apiKeys = { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'api-key' };

  describe('dispatch', () => {
    it('should throw an error when the provider is not supported', async () => {
      const dispatcher = new ProviderDispatcher({}, new RemoteTools(apiKeys));
      await expect(dispatcher.dispatch('unsupported', {} as DispatchBody)).rejects.toThrow();
    });
  });

  describe('openai', () => {
    describe('when openai is not configured', () => {
      it('should throw an error', async () => {
        const dispatcher = new ProviderDispatcher({}, new RemoteTools(apiKeys));
        await expect(dispatcher.dispatch('openai', {} as DispatchBody)).rejects.toThrow();
      });
    });

    describe('when openai is configured', () => {
      it('should return the response from openai', async () => {
        const dispatcher = new ProviderDispatcher(
          {
            openai: {
              clientOptions: { apiKey: 'dev' },
              chatConfiguration: { model: 'gpt-4o' },
            },
          },
          new RemoteTools(apiKeys),
        );
        const response = await dispatcher.dispatch('openai', {
          tools: {},
          messages: {},
        } as DispatchBody);
        expect(response).toBe('response');
      });

      describe('when the user tries to override the configuration', () => {
        it('should not allow the user to override the configuration', async () => {
          const dispatcher = new ProviderDispatcher(
            {
              openai: {
                clientOptions: { apiKey: 'dev' },
                chatConfiguration: { model: 'BASE MODEL' },
              },
            },
            new RemoteTools(apiKeys),
          );
          await dispatcher.dispatch('openai', {
            model: 'OTHER MODEL',
            propertyInjection: 'hack',

            tools: {},
            messages: {},
            tool_choice: {},
          } as unknown as DispatchBody);

          expect(openaiCreateMock).toHaveBeenCalledWith({
            model: 'BASE MODEL',
            tools: {},
            messages: {},
            tool_choice: {},
          });
        });
      });

      describe('when the openai client throws an error', () => {
        it('should throw an OpenAIUnprocessableError', async () => {
          const dispatcher = new ProviderDispatcher(
            {
              openai: {
                clientOptions: { apiKey: 'dev' },
                chatConfiguration: { model: 'gpt-4o' },
              },
            },
            new RemoteTools(apiKeys),
          );
          openaiCreateMock.mockRejectedValueOnce(new Error('OpenAI error'));

          await expect(
            dispatcher.dispatch('openai', { tools: {}, messages: {} } as DispatchBody),
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
            openai: {
              clientOptions: { apiKey: 'dev' },
              chatConfiguration: { model: 'gpt-4o' },
            },
          },
          remoteTools,
        );
        await dispatcher.dispatch('openai', {
          tools: [
            {
              type: 'function',
              // parameters is an empty object because it simulates the front end sending an empty object
              // because it doesn't know the parameters of the tool
              function: { name: remoteTools.tools[0].base.name, parameters: {} },
            },
          ],
          messages: {},
        } as DispatchBody);

        expect(openaiCreateMock).toHaveBeenCalledWith({
          messages: {},
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
            openai: {
              clientOptions: { apiKey: 'dev' },
              chatConfiguration: { model: 'gpt-4o' },
            },
          },
          remoteTools,
        );
        await dispatcher.dispatch('openai', {
          tools: [
            {
              type: 'function',
              function: { name: 'notRemoteTool', parameters: {} },
            },
          ],
          messages: {},
        } as DispatchBody);

        expect(openaiCreateMock).toHaveBeenCalledWith({
          messages: {},
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
