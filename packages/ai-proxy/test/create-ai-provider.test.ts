import type { AiConfiguration } from '../src/provider';

import { createAiProvider } from '../src/create-ai-provider';
import { Router } from '../src/router';

jest.mock('../src/router');

describe('createAiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return an AiProviderDefinition with providers array from config', () => {
    const config: AiConfiguration = {
      name: 'my-ai',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
    };

    const result = createAiProvider(config);

    expect(result.providers).toEqual([{ name: 'my-ai', provider: 'openai' }]);
    expect(typeof result.init).toBe('function');
  });

  test('init should create a Router with the config and logger', () => {
    const config: AiConfiguration = {
      name: 'my-ai',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
    };

    const provider = createAiProvider(config);
    const mockLogger = jest.fn();
    provider.init(mockLogger);

    expect(Router).toHaveBeenCalledWith({
      aiConfigurations: [config],
      logger: mockLogger,
    });
  });

  test('init should return the Router instance', () => {
    const config: AiConfiguration = {
      name: 'my-ai',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
    };

    const mockRouterInstance = { route: jest.fn() };
    jest.mocked(Router).mockImplementation(() => mockRouterInstance as any);

    const provider = createAiProvider(config);
    const result = provider.init(jest.fn());

    expect(result).toBe(mockRouterInstance);
  });
});
