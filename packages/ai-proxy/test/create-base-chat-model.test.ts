import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';

import { createBaseChatModel } from '../src/create-base-chat-model';
import { AIBadRequestError } from '../src/errors';

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn(),
}));

jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn(),
}));

describe('createBaseChatModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a ChatOpenAI for openai provider with maxRetries: 0', () => {
    const config = {
      name: 'gpt4',
      provider: 'openai' as const,
      apiKey: 'test-key',
      model: 'gpt-4o',
    };

    createBaseChatModel(config);

    expect(ChatOpenAI).toHaveBeenCalledWith({
      maxRetries: 0,
      apiKey: 'test-key',
      model: 'gpt-4o',
    });
  });

  it('forwards extra options like temperature to ChatOpenAI', () => {
    const config = {
      name: 'gpt4',
      provider: 'openai' as const,
      apiKey: 'test-key',
      model: 'gpt-4o',
      temperature: 0.7,
    };

    createBaseChatModel(config);

    expect(ChatOpenAI).toHaveBeenCalledWith({
      maxRetries: 0,
      apiKey: 'test-key',
      model: 'gpt-4o',
      temperature: 0.7,
    });
  });

  it('forwards extra options like temperature to ChatAnthropic', () => {
    const config = {
      name: 'claude',
      provider: 'anthropic' as const,
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-latest' as const,
      temperature: 0.5,
    };

    createBaseChatModel(config);

    expect(ChatAnthropic).toHaveBeenCalledWith({
      maxRetries: 0,
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-latest',
      temperature: 0.5,
    });
  });

  it('does not pass __includeRawResponse for openai provider', () => {
    const config = {
      name: 'gpt4',
      provider: 'openai' as const,
      apiKey: 'test-key',
      model: 'gpt-4o',
    };

    createBaseChatModel(config);

    const passedArgs = (ChatOpenAI as unknown as jest.Mock).mock.calls[0][0];
    expect(passedArgs).not.toHaveProperty('__includeRawResponse');
  });

  it('creates a ChatAnthropic for anthropic provider with maxRetries: 0', () => {
    const config = {
      name: 'claude',
      provider: 'anthropic' as const,
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-latest' as const,
    };

    createBaseChatModel(config);

    expect(ChatAnthropic).toHaveBeenCalledWith({
      maxRetries: 0,
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-latest',
    });
  });

  it('throws AIBadRequestError for unsupported provider', () => {
    const config = {
      name: 'unknown',
      provider: 'unknown-provider' as any,
      model: 'some-model',
    };

    expect(() => createBaseChatModel(config)).toThrow(AIBadRequestError);
    expect(() => createBaseChatModel(config)).toThrow(
      "Unsupported AI provider 'unknown-provider'.",
    );
  });
});
