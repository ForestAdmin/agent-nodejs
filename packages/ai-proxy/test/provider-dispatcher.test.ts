import type { DispatchBody } from '../src';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';

import { AINotConfiguredError, ProviderDispatcher, RemoteTools } from '../src';

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
});
