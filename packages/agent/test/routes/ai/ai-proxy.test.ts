import { createMockContext } from '@shopify/jest-koa-mocks';

import AiProxyRoute from '../../../src/routes/ai/ai-proxy';
import { RouteType } from '../../../src/types';
import * as factories from '../../__factories__';

jest.mock('@forestadmin/ai-proxy', () => ({
  Router: jest.fn().mockImplementation(() => ({
    route: jest.fn().mockResolvedValue({ result: 'success' }),
  })),
}));

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
  });
});
