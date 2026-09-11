import { ChatAnthropic } from '@langchain/anthropic';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatOpenAI } from '@langchain/openai';

import { createBaseChatModel } from '../src/create-base-chat-model';
import { AIBadRequestError } from '../src/errors';

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn(),
}));

jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn(),
}));

jest.mock('@langchain/aws', () => ({
  ChatBedrockConverse: jest.fn(),
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

  describe('bedrock', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
      delete process.env.AWS_REGION;
      delete process.env.AWS_DEFAULT_REGION;
    });

    afterAll(() => {
      process.env = OLD_ENV;
    });

    it('creates a ChatBedrockConverse without an apiKey', () => {
      createBaseChatModel({
        name: 'bedrock',
        provider: 'bedrock',
        model: 'us.anthropic.claude-sonnet-4-6-v1:0',
        region: 'eu-west-3',
      });

      expect(ChatBedrockConverse).toHaveBeenCalledWith({
        maxRetries: 0,
        supportsToolChoiceValues: ['auto', 'any', 'tool'],
        model: 'us.anthropic.claude-sonnet-4-6-v1:0',
        region: 'eu-west-3',
      });
    });

    it('falls back to AWS_REGION, which LangChain itself ignores', () => {
      process.env.AWS_REGION = 'us-east-1';

      createBaseChatModel({ name: 'bedrock', provider: 'bedrock', model: 'amazon.nova-pro-v1:0' });

      expect(ChatBedrockConverse).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'us-east-1' }),
      );
    });

    it('prefers an explicit region over the environment', () => {
      process.env.AWS_REGION = 'us-east-1';

      createBaseChatModel({
        name: 'bedrock',
        provider: 'bedrock',
        model: 'amazon.nova-pro-v1:0',
        region: 'eu-west-3',
      });

      expect(ChatBedrockConverse).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'eu-west-3' }),
      );
    });

    it('lets the caller override the inferred tool_choice support', () => {
      createBaseChatModel({
        name: 'bedrock',
        provider: 'bedrock',
        model: 'amazon.titan-text-express-v1',
        region: 'eu-west-3',
        supportsToolChoiceValues: [],
      });

      expect(ChatBedrockConverse).toHaveBeenCalledWith(
        expect.objectContaining({ supportsToolChoiceValues: [] }),
      );
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
