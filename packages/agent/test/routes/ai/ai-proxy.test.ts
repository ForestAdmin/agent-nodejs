import { createMockContext } from '@shopify/jest-koa-mocks';
import { UnprocessableError } from '@forestadmin/datasource-toolkit';

import AiProxyRoute from '../../../src/routes/ai/ai-proxy';
import { RouteType } from '../../../src/types';
import * as factories from '../../__factories__';

const mockRoute = jest.fn().mockResolvedValue({ result: 'success' });

// Create actual error classes for testing - must be defined before jest.mock
// Using a factory function to avoid hoisting issues
jest.mock('@forestadmin/ai-proxy', () => {
  // Define error classes inside the mock factory
  class MockAIError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AIError';
    }
  }

  class MockAINotConfiguredError extends MockAIError {
    constructor() {
      super('AI is not configured. Please call addAI() on your agent.');
      this.name = 'AINotConfiguredError';
    }
  }

  class MockAIUnprocessableError extends MockAIError {
    constructor(message: string) {
      super(message);
      this.name = 'AIUnprocessableError';
    }
  }

  class MockAIToolNotFoundError extends MockAIError {
    constructor(message: string) {
      super(message);
      this.name = 'AIToolNotFoundError';
    }
  }

  return {
    Router: jest.fn().mockImplementation(() => ({
      route: mockRoute,
    })),
    AIError: MockAIError,
    AINotConfiguredError: MockAINotConfiguredError,
    AIUnprocessableError: MockAIUnprocessableError,
    AIToolNotFoundError: MockAIToolNotFoundError,
  };
});

// Get mocked error classes for testing
const {
  AINotConfiguredError,
  AIUnprocessableError,
  AIToolNotFoundError,
} = jest.requireMock('@forestadmin/ai-proxy');

describe('AiProxyRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an AiProxyRouter with the configuration', () => {
      const { Router } = jest.requireMock('@forestadmin/ai-proxy');
      const options = factories.forestAdminHttpDriverOptions.build();
      const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

      // eslint-disable-next-line no-new
      new AiProxyRoute(services, options, aiConfiguration);

      expect(Router).toHaveBeenCalledWith({
        aiConfiguration,
        logger: options.logger,
      });
    });
  });

  describe('type', () => {
    it('should be a private route', () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

      const route = new AiProxyRoute(services, options, aiConfiguration);

      expect(route.type).toBe(RouteType.PrivateRoute);
    });
  });

  describe('setupRoutes', () => {
    it('should register POST /_internal/ai-proxy/:route', () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

      const route = new AiProxyRoute(services, options, aiConfiguration);
      route.setupRoutes(router);

      expect(router.post).toHaveBeenCalledWith('/_internal/ai-proxy/:route', expect.any(Function));
    });
  });

  describe('handleAiProxy', () => {
    it('should route requests through the AI proxy router', async () => {
      const mcpServerConfigService = {
        getConfiguration: jest.fn().mockResolvedValue({ mcpServers: [] }),
      };
      const options = factories.forestAdminHttpDriverOptions.build({
        forestAdminClient: {
          mcpServerConfigService,
        } as never,
      });
      const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

      const route = new AiProxyRoute(services, options, aiConfiguration);

      const context = createMockContext({
        requestBody: { message: 'hello' },
        customProperties: {
          params: { route: 'chat' },
          query: { stream: 'true' },
        },
      });

      // Call the handler - access private method for testing
      // eslint-disable-next-line @typescript-eslint/dot-notation
      await route['handleAiProxy'](context);

      expect(context.response.body).toEqual({ result: 'success' });
      expect(context.response.status).toBe(200);
    });

    describe('error handling', () => {
      it('should convert AINotConfiguredError to UnprocessableError', async () => {
        mockRoute.mockRejectedValueOnce(new AINotConfiguredError());

        const mcpServerConfigService = {
          getConfiguration: jest.fn().mockResolvedValue({ mcpServers: [] }),
        };
        const options = factories.forestAdminHttpDriverOptions.build({
          forestAdminClient: { mcpServerConfigService } as never,
        });
        const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

        const route = new AiProxyRoute(services, options, aiConfiguration);
        const context = createMockContext({
          requestBody: {},
          customProperties: { params: { route: 'chat' }, query: {} },
        });

        // eslint-disable-next-line @typescript-eslint/dot-notation
        await expect(route['handleAiProxy'](context)).rejects.toThrow(
          'AI is not configured. Please call addAI() on your agent.',
        );
      });

      it('should convert AIUnprocessableError to UnprocessableError', async () => {
        mockRoute.mockRejectedValueOnce(new AIUnprocessableError('Provider error'));

        const mcpServerConfigService = {
          getConfiguration: jest.fn().mockResolvedValue({ mcpServers: [] }),
        };
        const options = factories.forestAdminHttpDriverOptions.build({
          forestAdminClient: { mcpServerConfigService } as never,
        });
        const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

        const route = new AiProxyRoute(services, options, aiConfiguration);
        const context = createMockContext({
          requestBody: {},
          customProperties: { params: { route: 'chat' }, query: {} },
        });

        // eslint-disable-next-line @typescript-eslint/dot-notation
        await expect(route['handleAiProxy'](context)).rejects.toThrow(UnprocessableError);
      });

      it('should convert AIToolNotFoundError to UnprocessableError', async () => {
        mockRoute.mockRejectedValueOnce(new AIToolNotFoundError('Tool not found'));

        const mcpServerConfigService = {
          getConfiguration: jest.fn().mockResolvedValue({ mcpServers: [] }),
        };
        const options = factories.forestAdminHttpDriverOptions.build({
          forestAdminClient: { mcpServerConfigService } as never,
        });
        const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

        const route = new AiProxyRoute(services, options, aiConfiguration);
        const context = createMockContext({
          requestBody: {},
          customProperties: { params: { route: 'chat' }, query: {} },
        });

        // eslint-disable-next-line @typescript-eslint/dot-notation
        await expect(route['handleAiProxy'](context)).rejects.toThrow(UnprocessableError);
      });

      it('should re-throw unknown errors', async () => {
        const unknownError = new Error('Unknown error');
        mockRoute.mockRejectedValueOnce(unknownError);

        const mcpServerConfigService = {
          getConfiguration: jest.fn().mockResolvedValue({ mcpServers: [] }),
        };
        const options = factories.forestAdminHttpDriverOptions.build({
          forestAdminClient: { mcpServerConfigService } as never,
        });
        const aiConfiguration = { provider: 'openai' as const, apiKey: 'test-key', model: 'gpt-4' };

        const route = new AiProxyRoute(services, options, aiConfiguration);
        const context = createMockContext({
          requestBody: {},
          customProperties: { params: { route: 'chat' }, query: {} },
        });

        // eslint-disable-next-line @typescript-eslint/dot-notation
        await expect(route['handleAiProxy'](context)).rejects.toThrow('Unknown error');
      });
    });
  });
});
